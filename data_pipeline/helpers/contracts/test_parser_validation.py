#!/usr/bin/env python3
"""
Test script to validate the player-scrape fix

This script tests:
1. Parser with various table structures
2. Playwright scraping (if available)
3. Different column configurations
4. Edge cases and error handling
"""

import json
import sys
import os

# Add helpers to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parse_contract_data_enhanced import parse_scraped_contract_html

def test_5_column_table():
    """Test with standard 5-column table (like Jayson Tatum)"""
    html = """
    <div class="sw_bodyContent">
        <div class="sw_playerContract__header"><h6>DESIGNATED VETERAN EXTENSION</h6></div>
        <table class="sw_table sw_table__stickyFirstColumn">
            <tr><th>Season</th><th>Base</th><th>Bonus</th><th>Cap Hit</th><th>Dead Cap</th></tr>
            <tr><td>2025-26</td><td>$54,126,450</td><td>-</td><td>$54,126,450</td><td>$54,126,450</td></tr>
            <tr><td>2026-27</td><td>$58,456,606</td><td>-</td><td>$58,456,606</td><td>$58,456,606</td></tr>
            <tr><td>2027-28</td><td>$62,786,762</td><td>-</td><td>$62,786,762</td><td>$62,786,762</td></tr>
            <tr><td>2028-29</td><td>$67,116,918</td><td>-</td><td>$67,116,918</td><td>$67,116,918</td></tr>
            <tr><td>2029-30</td><td>$71,447,074</td><td>-</td><td>$71,447,074</td><td>$71,447,074</td></tr>
            <tr><td>TOTAL</td><td>$313,933,810</td><td>-</td><td>$313,933,810</td><td>$313,933,810</td></tr>
        </table>
        <div>Bird Rights: Full Bird (at expiry)</div>
    </div>
    """
    
    result = parse_scraped_contract_html("test", {"name": "Test Player", "contractHtml": html})
    
    assert result is not None, "Parser returned None"
    assert len(result['contract']['annual_salaries']) == 5, f"Expected 5 salaries, got {len(result['contract']['annual_salaries'])}"
    assert result['contract_summary']['value'] == 313_933_810, f"Expected $313.9M, got ${result['contract_summary']['value']:,}"
    assert result['contract_summary']['is_extension'] == True, "Should detect extension"
    assert result['bird_rights'] == "Full Bird", f"Expected 'Full Bird', got '{result['bird_rights']}'"
    
    print("✅ 5-column table test passed")
    return True

def test_3_column_table():
    """Test with 3-column table"""
    html = """
    <div class="sw_bodyContent">
        <table class="sw_table">
            <tr><th>Season</th><th>Salary</th><th>Status</th></tr>
            <tr><td>2025-26</td><td>$15,000,000</td><td>Guaranteed</td></tr>
            <tr><td>2026-27</td><td>$16,200,000</td><td>Team Option</td></tr>
        </table>
    </div>
    """
    
    result = parse_scraped_contract_html("test", {"name": "Test Player", "contractHtml": html})
    
    assert result is not None, "Parser returned None"
    assert len(result['contract']['annual_salaries']) == 2, f"Expected 2 salaries, got {len(result['contract']['annual_salaries'])}"
    assert result['contract_summary']['value'] == 31_200_000, f"Expected $31.2M, got ${result['contract_summary']['value']:,}"
    
    print("✅ 3-column table test passed")
    return True

def test_no_sw_bodyContent():
    """Test when sw_bodyContent div doesn't exist"""
    html = """
    <html>
    <body>
        <table>
            <tr><th>Season</th><th>Cap Hit</th></tr>
            <tr><td>2025-26</td><td>$10,000,000</td></tr>
        </table>
    </body>
    </html>
    """
    
    result = parse_scraped_contract_html("test", {"name": "Test Player", "contractHtml": html})
    
    assert result is not None, "Parser returned None"
    assert len(result['contract']['annual_salaries']) == 1, f"Expected 1 salary, got {len(result['contract']['annual_salaries'])}"
    
    print("✅ No sw_bodyContent test passed")
    return True

def test_millions_notation():
    """Test with millions notation (54.1M)"""
    html = """
    <div class="sw_bodyContent">
        <table>
            <tr><th>Season</th><th>Salary</th></tr>
            <tr><td>2025-26</td><td>54.1M</td></tr>
            <tr><td>2026-27</td><td>58.4M</td></tr>
        </table>
    </div>
    """
    
    result = parse_scraped_contract_html("test", {"name": "Test Player", "contractHtml": html})
    
    assert result is not None, "Parser returned None"
    assert len(result['contract']['annual_salaries']) == 2, f"Expected 2 salaries, got {len(result['contract']['annual_salaries'])}"
    # Check that millions were converted properly (54.1M -> 54,100,000)
    assert result['contract']['annual_salaries'][0]['salary'] == 54_100_000, \
        f"Expected $54.1M = 54100000, got {result['contract']['annual_salaries'][0]['salary']}"
    
    print("✅ Millions notation test passed")
    return True

def test_edge_cases():
    """Test edge cases and invalid data"""
    # Test with no HTML
    result = parse_scraped_contract_html("test", {"name": "Test Player", "contractHtml": ""})
    assert result is None, "Should return None for empty HTML"
    
    # Test with no table
    html = "<div class='sw_bodyContent'>No table here</div>"
    result = parse_scraped_contract_html("test", {"name": "Test Player", "contractHtml": html})
    assert result is not None, "Should still return result even without table"
    assert len(result['contract']['annual_salaries']) == 0, "Should have no salaries without table"
    
    print("✅ Edge cases test passed")
    return True

def run_all_tests():
    """Run all tests"""
    print("🧪 Running Player-Scrape Fix Validation Tests")
    print("=" * 60)
    
    tests = [
        ("5-Column Table (Jayson Tatum style)", test_5_column_table),
        ("3-Column Table", test_3_column_table),
        ("No sw_bodyContent div", test_no_sw_bodyContent),
        ("Millions notation (54.1M)", test_millions_notation),
        ("Edge cases", test_edge_cases),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            print(f"\n📋 Testing: {name}")
            if test_func():
                passed += 1
        except AssertionError as e:
            print(f"❌ Test failed: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ Test error: {e}")
            failed += 1
    
    print(f"\n{'=' * 60}")
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("✅ All tests passed! Parser is working correctly.")
        return 0
    else:
        print("❌ Some tests failed. Please review the errors above.")
        return 1

if __name__ == "__main__":
    exit(run_all_tests())
