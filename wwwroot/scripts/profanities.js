
const filterProfanities = (() => {

    let profanities = null;

    fetch("/res/profanities.txt")
        .then(r => r.text())
        .then(t => {
            profanities = new Set();
            t.split("\n").forEach(w => profanities.add(w.trim()));
        });

    function isProfanity(word) {
        const trimmed = word.trim();
        if (trimmed.length === 0) { return trimmed; }
        const normalized = trimmed
            .toLowerCase()
            .normalize("NFKC");
        return profanities.has(normalized);
    }

    function filterText(text) {
        const words = text.split(" ");
        const result = [];
        for (let i = 0; i < words.length;) {
            if (!isProfanity(words[i])) {
                result.push(words[i]);
                i += 1;
                continue;
            }
            let replaced = "🚂";
            i += 1;
            while (i < words.length && isProfanity(words[i])) {
                replaced += "🚃";
                i += 1;
            }
            result.push(replaced);
        }
        return result.join(" ");
    }

    const tryFilterText = text => profanities === null 
        ? text
        : filterText(text); 

    return tryFilterText;

})();

