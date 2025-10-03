module.exports = {
  validateTarget: function (t) {
    const errs = [];
    if (!t || typeof t !== 'object') {
      return ['target not object'];
    }
    if (!t.bio) errs.push('bio missing');
    if (t.bio) {
      if (typeof t.bio.displayName !== 'string')
        errs.push('bio.displayName string');
      if (typeof t.bio.position !== 'string') errs.push('bio.position string');
      if (typeof t.bio.age !== 'number') errs.push('bio.age number');
      if (t.bio.height != null && typeof t.bio.height !== 'number')
        errs.push('bio.height number (inches)');
    }
    const og = t.evaluations && t.evaluations.overallGrade;
    if (og != null && (typeof og !== 'number' || og < 0 || og > 100))
      errs.push('evaluations.overallGrade 0..100');
    return errs;
  },
};
