/**
 * Simple string similarity function
 * Helps find the best match from NovelBuddy.
 */
function getSimilarity(s1, s2) {
    let longer = s1.toLowerCase();
    let shorter = s2.toLowerCase();
    if (s1.length < s2.length) {
        longer = s2.toLowerCase();
        shorter = s1.toLowerCase();
    }
    let longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    // Simple similarity check (not Levenshtein)
    let nonMatchCount = 0;
    for(let i = 0; i < longer.length; i++) {
        if (longer[i] !== shorter[i]) {
            nonMatchCount++;
        }
    }
    return (longerLength - nonMatchCount) / parseFloat(longerLength);
}
