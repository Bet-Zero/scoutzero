#!/usr/bin/env python3
"""
Enhanced Data Pipeline Implementation Example

This demonstrates how an improved data pipeline would work with better
orchestration, validation, and error handling compared to the current approach.
"""

import asyncio
import json
import logging
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Callable, Any
from abc import ABC, abstractmethod

# ==========================================
# 1. PIPELINE FRAMEWORK
# ==========================================

class StepStatus(Enum):
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"

@dataclass
class StepResult:
    success: bool
    data: Any = None
    errors: List[str] = None
    warnings: List[str] = None
    metadata: Dict[str, Any] = None

@dataclass
class ValidationResult:
    valid: bool
    errors: List[str] = None
    warnings: List[str] = None

class PipelineStep(ABC):
    """Abstract base class for pipeline steps"""
    
    def __init__(self, name: str, dependencies: List[str] = None):
        self.name = name
        self.dependencies = dependencies or []
        self.status = StepStatus.PENDING
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.result: Optional[StepResult] = None
        self.snapshot_data: Optional[Any] = None

    @abstractmethod
    async def execute(self, context: Dict[str, Any]) -> StepResult:
        """Execute the step logic"""
        pass

    @abstractmethod
    async def validate(self, data: Any) -> ValidationResult:
        """Validate the step's output"""
        pass

    @abstractmethod
    async def rollback(self, context: Dict[str, Any]) -> bool:
        """Rollback changes made by this step"""
        pass

    async def create_snapshot(self, context: Dict[str, Any]) -> Any:
        """Create a snapshot before execution for rollback purposes"""
        # Default implementation - can be overridden
        return None

    async def run(self, context: Dict[str, Any]) -> StepResult:
        """Run the complete step with error handling"""
        self.status = StepStatus.RUNNING
        self.start_time = datetime.now(timezone.utc)
        
        try:
            # Create snapshot for rollback
            self.snapshot_data = await self.create_snapshot(context)
            
            # Execute the step
            result = await self.execute(context)
            
            if result.success:
                # Validate output
                validation = await self.validate(result.data)
                if not validation.valid:
                    result.success = False
                    result.errors = (result.errors or []) + (validation.errors or [])
                
            self.result = result
            self.status = StepStatus.COMPLETED if result.success else StepStatus.FAILED
            
        except Exception as e:
            self.result = StepResult(
                success=False,
                errors=[f"Step execution failed: {str(e)}"],
                metadata={"exception": str(e), "traceback": traceback.format_exc()}
            )
            self.status = StepStatus.FAILED
        
        finally:
            self.end_time = datetime.now(timezone.utc)
        
        return self.result

class PipelineOrchestrator:
    """Orchestrates pipeline execution with dependency management"""
    
    def __init__(self):
        self.steps: Dict[str, PipelineStep] = {}
        self.execution_order: List[str] = []
        self.context: Dict[str, Any] = {}

    def add_step(self, step: PipelineStep):
        """Add a step to the pipeline"""
        self.steps[step.name] = step

    def build_execution_order(self) -> List[str]:
        """Build execution order based on dependencies"""
        visited = set()
        order = []
        
        def visit(step_name: str):
            if step_name in visited:
                return
            
            step = self.steps[step_name]
            for dep in step.dependencies:
                if dep not in self.steps:
                    raise ValueError(f"Dependency '{dep}' not found for step '{step_name}'")
                visit(dep)
            
            visited.add(step_name)
            order.append(step_name)
        
        for step_name in self.steps.keys():
            visit(step_name)
        
        return order

    async def execute_pipeline(self, context: Dict[str, Any] = None) -> Dict[str, StepResult]:
        """Execute the entire pipeline"""
        if context:
            self.context.update(context)
        
        self.execution_order = self.build_execution_order()
        results = {}
        
        logging.info(f"Starting pipeline execution with {len(self.steps)} steps")
        logging.info(f"Execution order: {' -> '.join(self.execution_order)}")
        
        for step_name in self.execution_order:
            step = self.steps[step_name]
            
            # Check if dependencies succeeded
            for dep in step.dependencies:
                dep_result = results.get(dep)
                if not dep_result or not dep_result.success:
                    logging.error(f"Step '{step_name}' skipped due to failed dependency '{dep}'")
                    results[step_name] = StepResult(
                        success=False,
                        errors=[f"Dependency '{dep}' failed"]
                    )
                    break
            else:
                # All dependencies succeeded, execute step
                logging.info(f"Executing step: {step_name}")
                result = await step.run(self.context)
                results[step_name] = result
                
                if result.success:
                    logging.info(f"Step '{step_name}' completed successfully")
                    # Add step results to context for subsequent steps
                    self.context[f"{step_name}_result"] = result.data
                else:
                    logging.error(f"Step '{step_name}' failed: {result.errors}")
                    
                    # Decide whether to continue or stop
                    if self.should_stop_on_failure(step_name):
                        logging.error("Pipeline stopped due to critical step failure")
                        break
        
        return results

    async def rollback_pipeline(self, up_to_step: str = None) -> Dict[str, bool]:
        """Rollback pipeline changes"""
        rollback_results = {}
        
        # Rollback in reverse order
        rollback_order = list(reversed(self.execution_order))
        if up_to_step:
            try:
                cutoff = rollback_order.index(up_to_step)
                rollback_order = rollback_order[:cutoff + 1]
            except ValueError:
                logging.warning(f"Step '{up_to_step}' not found in execution order")
        
        for step_name in rollback_order:
            step = self.steps[step_name]
            if step.status == StepStatus.COMPLETED:
                logging.info(f"Rolling back step: {step_name}")
                try:
                    success = await step.rollback(self.context)
                    rollback_results[step_name] = success
                    if success:
                        step.status = StepStatus.ROLLED_BACK
                        logging.info(f"Step '{step_name}' rolled back successfully")
                    else:
                        logging.error(f"Failed to rollback step '{step_name}'")
                except Exception as e:
                    logging.error(f"Error rolling back step '{step_name}': {e}")
                    rollback_results[step_name] = False
        
        return rollback_results

    def should_stop_on_failure(self, step_name: str) -> bool:
        """Determine if pipeline should stop when a step fails"""
        # Can be customized based on step criticality
        critical_steps = {"discover_players", "update_contracts", "validate_data"}
        return step_name in critical_steps

# ==========================================
# 2. CONCRETE STEP IMPLEMENTATIONS
# ==========================================

class PlayerDiscoveryStep(PipelineStep):
    """Discover and merge player data from multiple sources"""
    
    def __init__(self):
        super().__init__(name="discover_players", dependencies=[])

    async def execute(self, context: Dict[str, Any]) -> StepResult:
        """Discover players from multiple sources"""
        try:
            discovered_players = {}
            sources_used = []
            
            # Source 1: Existing player database
            existing_players = await self.load_existing_players()
            discovered_players.update(existing_players)
            sources_used.append(f"existing_db ({len(existing_players)} players)")
            
            # Source 2: External APIs (with fallback)
            try:
                api_players = await self.fetch_from_apis()
                new_players = self.merge_player_data(discovered_players, api_players)
                discovered_players.update(new_players)
                sources_used.append(f"external_apis ({len(new_players)} new)")
            except Exception as e:
                logging.warning(f"External API fetch failed, continuing with existing data: {e}")
            
            # Source 3: Contract data filtering
            try:
                discovered_players = await self.filter_by_contracts(discovered_players)
                sources_used.append("contract_filtering")
            except Exception as e:
                logging.warning(f"Contract filtering failed: {e}")
            
            return StepResult(
                success=True,
                data=discovered_players,
                metadata={
                    "player_count": len(discovered_players),
                    "sources_used": sources_used,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
        except Exception as e:
            return StepResult(
                success=False,
                errors=[f"Player discovery failed: {str(e)}"]
            )

    async def validate(self, data: Any) -> ValidationResult:
        """Validate discovered player data"""
        if not isinstance(data, dict):
            return ValidationResult(valid=False, errors=["Data must be a dictionary"])
        
        errors = []
        warnings = []
        
        # Check minimum player count
        if len(data) < 400:
            warnings.append(f"Only {len(data)} players found, expected at least 400")
        
        # Validate player data structure
        for player_id, player_data in data.items():
            if not isinstance(player_data, dict):
                errors.append(f"Player {player_id} data is not a dictionary")
                continue
            
            # Required fields
            required_fields = ["name", "bio"]
            for field in required_fields:
                if field not in player_data:
                    errors.append(f"Player {player_id} missing required field: {field}")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )

    async def rollback(self, context: Dict[str, Any]) -> bool:
        """Rollback player discovery changes"""
        # For discovery step, rollback means restoring previous player list
        if self.snapshot_data:
            context["players"] = self.snapshot_data
            return True
        return False

    async def create_snapshot(self, context: Dict[str, Any]) -> Any:
        """Create snapshot of current player data"""
        return context.get("players", {}).copy()

    async def load_existing_players(self) -> Dict:
        """Load existing player database"""
        # Implementation would load from Firestore or local files
        return {}

    async def fetch_from_apis(self) -> Dict:
        """Fetch player data from external APIs"""
        # Implementation would call external APIs
        return {}

    def merge_player_data(self, existing: Dict, new: Dict) -> Dict:
        """Merge new player data with existing"""
        # Implementation would handle smart merging
        return {}

    async def filter_by_contracts(self, players: Dict) -> Dict:
        """Filter players based on contract data"""
        # Implementation would filter out players with $0 contracts, etc.
        return players

class ContractUpdateStep(PipelineStep):
    """Update contract data for all players"""
    
    def __init__(self):
        super().__init__(name="update_contracts", dependencies=["discover_players"])

    async def execute(self, context: Dict[str, Any]) -> StepResult:
        """Update contract data"""
        try:
            players = context.get("discover_players_result", {})
            if not players:
                return StepResult(success=False, errors=["No player data available"])
            
            updated_players = {}
            contract_sources = []
            
            # Update contracts from multiple sources
            for player_id, player_data in players.items():
                try:
                    updated_contract = await self.fetch_player_contract(player_id)
                    if updated_contract:
                        player_data["contract"] = updated_contract
                        player_data["contract_clean"] = self.clean_contract_data(updated_contract)
                    
                    updated_players[player_id] = player_data
                    
                except Exception as e:
                    logging.warning(f"Failed to update contract for {player_id}: {e}")
                    updated_players[player_id] = player_data  # Keep existing data
            
            return StepResult(
                success=True,
                data=updated_players,
                metadata={
                    "contracts_updated": len(updated_players),
                    "sources_used": contract_sources,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
        except Exception as e:
            return StepResult(
                success=False,
                errors=[f"Contract update failed: {str(e)}"]
            )

    async def validate(self, data: Any) -> ValidationResult:
        """Validate contract data"""
        errors = []
        warnings = []
        
        for player_id, player_data in data.items():
            contract = player_data.get("contract")
            if contract:
                # Validate contract structure
                if "total_value" not in contract:
                    warnings.append(f"Player {player_id} missing total_value in contract")
                
                if "years" not in contract:
                    warnings.append(f"Player {player_id} missing years in contract")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )

    async def rollback(self, context: Dict[str, Any]) -> bool:
        """Rollback contract updates"""
        if self.snapshot_data:
            # Restore previous contract data
            context["contracts"] = self.snapshot_data
            return True
        return False

    async def fetch_player_contract(self, player_id: str) -> Dict:
        """Fetch contract data for a specific player"""
        # Implementation would call contract APIs
        return {}

    def clean_contract_data(self, contract: Dict) -> Dict:
        """Clean and normalize contract data"""
        # Implementation would standardize contract format
        return contract

class AggregationStep(PipelineStep):
    """Compute aggregated fields and indexes"""
    
    def __init__(self):
        super().__init__(name="compute_aggregations", 
                        dependencies=["discover_players", "update_contracts"])

    async def execute(self, context: Dict[str, Any]) -> StepResult:
        """Compute aggregated fields"""
        try:
            players = context.get("update_contracts_result", {})
            if not players:
                return StepResult(success=False, errors=["No player data available"])
            
            # Compute aggregations
            aggregated_players = {}
            player_index = []
            
            for player_id, player_data in players.items():
                # Add computed fields
                computed_fields = await self.compute_player_aggregations(player_data)
                player_data["computed"] = computed_fields
                
                # Create index entry
                index_entry = self.create_index_entry(player_id, player_data)
                player_index.append(index_entry)
                
                aggregated_players[player_id] = player_data
            
            return StepResult(
                success=True,
                data={
                    "players": aggregated_players,
                    "player_index": player_index
                },
                metadata={
                    "players_processed": len(aggregated_players),
                    "index_entries": len(player_index),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
        except Exception as e:
            return StepResult(
                success=False,
                errors=[f"Aggregation computation failed: {str(e)}"]
            )

    async def validate(self, data: Any) -> ValidationResult:
        """Validate aggregated data"""
        errors = []
        warnings = []
        
        players = data.get("players", {})
        player_index = data.get("player_index", [])
        
        # Validate counts match
        if len(players) != len(player_index):
            errors.append(f"Player count mismatch: {len(players)} players vs {len(player_index)} index entries")
        
        # Validate computed fields
        for player_id, player_data in players.items():
            computed = player_data.get("computed", {})
            if not computed:
                warnings.append(f"Player {player_id} missing computed fields")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )

    async def rollback(self, context: Dict[str, Any]) -> bool:
        """Rollback aggregation computation"""
        # Remove computed fields from players
        return True

    async def compute_player_aggregations(self, player_data: Dict) -> Dict:
        """Compute aggregated fields for a player"""
        # Implementation would compute salary by year, trade value, etc.
        return {
            "salary_by_year": {},
            "trade_value": 0,
            "cap_impact": 0,
            "formatted_position": "",
            "height_inches": 0
        }

    def create_index_entry(self, player_id: str, player_data: Dict) -> Dict:
        """Create lightweight index entry for a player"""
        bio = player_data.get("bio", {})
        computed = player_data.get("computed", {})
        
        return {
            "player_id": player_id,
            "name": player_data.get("name", ""),
            "position": computed.get("formatted_position", ""),
            "team": bio.get("Team", ""),
            "age": bio.get("AGE", 0),
            "salary_current": computed.get("cap_impact", 0),
            "overall_grade": player_data.get("overall_grade", ""),
            "status": "Signed"
        }

class FirestoreUploadStep(PipelineStep):
    """Upload data to Firestore"""
    
    def __init__(self):
        super().__init__(name="upload_to_firestore", 
                        dependencies=["compute_aggregations"])

    async def execute(self, context: Dict[str, Any]) -> StepResult:
        """Upload data to Firestore"""
        try:
            data = context.get("compute_aggregations_result", {})
            if not data:
                return StepResult(success=False, errors=["No aggregated data available"])
            
            players = data.get("players", {})
            player_index = data.get("player_index", [])
            
            # Upload in batches
            uploaded_players = await self.upload_players_batch(players)
            uploaded_index = await self.upload_index_batch(player_index)
            
            return StepResult(
                success=True,
                data={
                    "players_uploaded": uploaded_players,
                    "index_uploaded": uploaded_index
                },
                metadata={
                    "upload_timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
        except Exception as e:
            return StepResult(
                success=False,
                errors=[f"Firestore upload failed: {str(e)}"]
            )

    async def validate(self, data: Any) -> ValidationResult:
        """Validate upload results"""
        # Could verify upload counts, check Firestore, etc.
        return ValidationResult(valid=True)

    async def rollback(self, context: Dict[str, Any]) -> bool:
        """Rollback Firestore uploads"""
        # Could restore from backup or delete uploaded documents
        return True

    async def upload_players_batch(self, players: Dict) -> int:
        """Upload players in batches to Firestore"""
        # Implementation would use Firebase Admin SDK
        return len(players)

    async def upload_index_batch(self, player_index: List) -> int:
        """Upload player index to Firestore"""
        # Implementation would upload to player_index collection
        return len(player_index)

# ==========================================
# 3. PIPELINE CONFIGURATION
# ==========================================

def create_season_update_pipeline() -> PipelineOrchestrator:
    """Create the complete season update pipeline"""
    orchestrator = PipelineOrchestrator()
    
    # Add steps in dependency order
    orchestrator.add_step(PlayerDiscoveryStep())
    orchestrator.add_step(ContractUpdateStep())
    orchestrator.add_step(AggregationStep())
    orchestrator.add_step(FirestoreUploadStep())
    
    return orchestrator

async def run_season_update():
    """Run the complete season update pipeline"""
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # Create and execute pipeline
    pipeline = create_season_update_pipeline()
    
    try:
        results = await pipeline.execute_pipeline({
            "season": "2025-26",
            "mode": "production"
        })
        
        # Check overall success
        all_successful = all(result.success for result in results.values())
        
        if all_successful:
            logging.info("🎉 Pipeline completed successfully!")
            
            # Print summary
            for step_name, result in results.items():
                metadata = result.metadata or {}
                logging.info(f"✅ {step_name}: {metadata}")
        else:
            logging.error("❌ Pipeline completed with failures:")
            
            failed_steps = [name for name, result in results.items() if not result.success]
            logging.error(f"Failed steps: {failed_steps}")
            
            # Optionally rollback
            logging.info("Starting rollback...")
            rollback_results = await pipeline.rollback_pipeline()
            logging.info(f"Rollback results: {rollback_results}")
            
    except Exception as e:
        logging.error(f"Pipeline execution failed: {e}")
        logging.error(traceback.format_exc())

# ==========================================
# 4. CLI INTERFACE
# ==========================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced ScoutZero Data Pipeline")
    parser.add_argument("--mode", choices=["production", "test"], default="test",
                       help="Pipeline execution mode")
    parser.add_argument("--rollback-to", type=str, 
                       help="Rollback pipeline to specific step")
    parser.add_argument("--validate-only", action="store_true",
                       help="Only run validation without execution")
    
    args = parser.parse_args()
    
    if args.rollback_to:
        # Rollback functionality
        print(f"Rolling back to step: {args.rollback_to}")
        # Implementation would rollback to specific step
    elif args.validate_only:
        # Validation-only mode
        print("Running validation checks...")
        # Implementation would run validation without execution
    else:
        # Normal execution
        asyncio.run(run_season_update())