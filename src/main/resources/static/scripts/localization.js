
const SHORT_LOCALES = Object.freeze([
    "en",
    "de",
    "bg"
]);

const LOCALIZATION = Object.freeze({
    
    "titlebar": {
        "en": "Linton Railway • The Party Game with Trains",
        "de": "Lintonbahn • Das Partyspiel mit Zügen",
        "bg": "Линтънска железница • Парти играта с влакчета"
    },
    "title": {
        "en": "Linton Railway",
        "de": "Lintonbahn",
        "bg": "Линтънска железница"
    },

    "createPrivateRoom": {
        "en": "Create Private Room",
        "de": "Privaten Raum Erstellen",
        "bg": null
    },
    "roomCreationFailed": {
        "en": "Failed to create a room. Please try again.",
        "de": "Konnte keinen Raum erstellen. Bitte erneut versuchen.",
        "bg": null
    },
    "roomCreationCooldown": {
        "en": "Please wait before creating another room.",
        "de": "Bitte warten Sie, bevor sie erneut einen Raum erstellen.",
        "bg": null
    },

    "joinRoom": {
        "en": "Join Room",
        "de": "Raum Beitreten",
        "bg": null
    },
    "usernameInput": {
        "en": "Username:",
        "de": "Nutzername:",
        "bg": null
    },

    "copyInviteLink": {
        "en": "Copy Invitation Link",
        "de": "Einladungslink Kopieren",
        "bg": null
    },
    "players": {
        "en": "Players",
        "de": "Spieler",
        "bg": null
    },
    "playerNotReady": {
        "en": "Not Ready",
        "de": "Nicht Bereit",
        "bg": null
    },
    "playerReady": {
        "en": "Ready",
        "de": "Bereit",
        "bg": null
    },
    "getReady": {
        "en": "I Am Ready",
        "de": "Ich Bin Bereit",
        "bg": null
    }

});

const selectedLocale = localStorage.selectedLocale || detectLocale() || "en";

function detectLocale() {
    const userLocale = navigator.language || navigator.userLanguage;
    const locale = userLocale.split("-")[0];
    if(!SHORT_LOCALES.includes(locale)) { return undefined; }
    localStorage.selectedLocale = locale;
    return locale;
}

function setSelectedLocale(locale) {
    localStorage.selectedLocale = locale;
    location.reload();
}

const getLocalized = key => LOCALIZATION[key][localStorage.selectedLocale];

window.addEventListener("load", () => {
    const elements = document.querySelectorAll("*");
    for(const e of elements) {
        const key = e.getAttribute("localized");
        if(key === null) { continue; }
        e.innerText = getLocalized(key);
    }
});