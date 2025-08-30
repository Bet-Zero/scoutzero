# 🏀 ScoutZero Season Management

Complete system for managing NBA season transitions while preserving all user data.

## 🚀 Quick Start - New Season Setup

**For the impatient (but please read the full guide later):**

```bash
# One command to rule them all
npm run season:transition --from-season 2024 --to-season 2025
```

## 📚 Documentation

- **[Complete Season Transition Guide](./SEASON_TRANSITION_GUIDE.md)** - Comprehensive step-by-step process
- **[Troubleshooting Guide](./SEASON_TRANSITION_TROUBLESHOOTING.md)** - Solutions for common issues

## 🎯 What This System Does

### ✅ Preserves Your User Data
- **Grades, roles, traits, badges, blurbs** - All carried forward seamlessly  
- **Archive history** - Complete historical data maintained
- **Cross-season connectivity** - View player evolution across multiple seasons

### 🔄 Updates System Data  
- **Contract information** - New teams, salaries, contract years
- **Bio updates** - Age, team changes, status updates
- **Stats preparation** - Ready for new season without losing old stats

### 🛡️ Safety First
- **Validation checks** - Verify data integrity at each step
- **Rollback capability** - Archive system provides safety net
- **Error handling** - Graceful failure with clear next steps

## 📋 Available Commands

### Season Management
```bash
npm run season:list                    # List all seasons
npm run season:create {year}           # Create new season
npm run season:archive {year}          # Archive season data
```

### Data Updates
```bash
npm run contracts:update               # Update contracts and bio data
npm run stats:update                   # Update player stats (run when season starts)
npm run season:prepare-stats           # Prepare stats structure for new season
```

### Validation & Troubleshooting
```bash
npm run season:validate {from} {to}    # Validate transition integrity
npm run season:validate {from} {to} --quick-check  # Quick spot check
```

### Complete Workflows
```bash
npm run season:transition --from-season {old} --to-season {new}  # Full transition
npm run season:transition --help       # See all options
```

## ⚡ Typical Workflow

1. **End of Season (June):**
   ```bash
   npm run season:archive 2024
   ```

2. **Start of Offseason (July):**
   ```bash
   npm run season:create 2025
   npm run contracts:update
   npm run season:prepare-stats --season 2025
   ```

3. **Validation:**
   ```bash
   npm run season:validate 2024 2025
   ```

4. **When New Season Starts (October):**
   ```bash
   npm run stats:update
   ```

## 🔧 Setup Requirements

1. **Firebase Service Account Key:** Place at `src/serviceAccountKey.json`
2. **Python Dependencies:** `pip install firebase-admin`
3. **Node Dependencies:** `npm install` (already done if you're reading this)

## 🚨 Important Notes

- **ALWAYS test in development first**
- **ALWAYS backup your Firestore database before major transitions**
- **DON'T run stats updates until the new season actually starts**
- **DO read the full documentation before your first transition**

## 🆘 If Something Goes Wrong

1. **Stop immediately** - Don't continue if you see errors
2. **Check troubleshooting guide** - Most issues have known solutions
3. **Verify archive data** - Your previous season should be safe
4. **Seek help** - Better safe than sorry with user data

## 📊 Data Flow Summary

```
Old Season Data → Archive → Preserve User Data → Update System Data → New Season Ready
     ↓              ↓           ↓                    ↓                  ↓
  (players/)  (seasons/old/) (carry forward)  (new contracts)    (players/ updated)
```

Your user grades, roles, traits, badges, and blurbs always flow forward. Only contracts, bios, and stats get updated with new season information.

## 🎉 Success Metrics

After a successful transition:
- ✅ All user grades preserved and accessible
- ✅ Contract updates reflect team changes
- ✅ Archive history intact and browsable  
- ✅ Stats structure ready for new season
- ✅ No user data lost or corrupted

**Remember:** This system is designed to be foolproof, but always test thoroughly and maintain backups!