
const SHORT_LOCALES = Object.freeze([
    "en",
    "de",
    "bg"
]);

const LOCALIZATION = Object.freeze({
    
    "titlebar": {
        "en": "Linton Railway • The Party Game with Trains",
        "de": "Linton Railway • Das Partyspiel mit Zügen",
        "bg": "Линтън Рейлуей • Парти играта с влакчета"
    },
    "title": {
        "en": "Linton Railway",
        "de": "Linton Railway",
        "bg": "Линтън Рейлуей"
    },
    "gameDescription": {
        "en": `...is a browser party game about managing trains on a model railway.
 Will you work together to maximize profit or deceive each other to gain an advantage?`,
        "de": `...ist ein Browser-Partyspiel, bei dem du Züge auf einer Modelleisenbahn verwaltest. 
 Arbeitet ihr zusammen, um Gewinne zu maximieren, oder täuscht ihr euch gegenseitig, um einen Vorteil zu erlangen?`,
        "bg": null
    },

    "createPrivateRoom": {
        "en": "Create Private Room",
        "de": "Privaten Raum Erstellen",
        "bg": null
    },
    "joinPublicRoom": {
        "en": "Join Public Room",
        "de": "Öffentlichem Raum Beitreten",
        "bg": null,
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
    "enterNicknamePrompt": {
        "en": `Choose a nickname under which to join the room. Please choose a name that
 is respectful and appropriate, as it will be visible to other players.`,
        "de": `Wählen Sie einen Spitznamen, unter dem Sie dem Raum beitreten möchten.
 Bitte wählen Sie einen respektvollen und angemessenen Namen, da dieser für andere Spieler sichtbar sein wird.`,
        "bg": null
    },
    "usernameInput": {
        "en": "Enter Nickname",
        "de": "Nickname Eingeben",
        "bg": null
    },

    "roomCrashedTitle": {
        "en": "Whoops! The Room Crashed :(",
        "de": "Ups! Der Raum ist Abgestürzt :(",
        "bg": null
    },
    "roomCrashDescription": {
        "en": `The room you were in encountered a critical error and had to be
 closed. This is not supposed to happen, so it would be greatly appreciated if
 you could file an issue
 <a href="https://github.com/schwalbe-t/linton_railway/issues">on the Linton Railway Github</a>
 describing what happened prior to the crash occuring.`,
        "de": `In Ihrem Raum ist ein kritischer Fehler aufgetreten und er musste
 geschlossen werden. Da dies nicht normal ist wären wir Ihnen sehr dankbar, wenn Sie
 das Problem 
 <a href="https://github.com/schwalbe-t/linton_railway/issues">im Linton Railway Github</a>
 melden könnten und beschreiben würden, was vor dem Absturz passiert ist.`,
        "bg": null
    },
    "clientDisconnectedTitle": {
        "en": "Whoops! You were disconnected :(",
        "de": "Ups! Verbindung getrennt :(",
        "bg": null,
    },
    "clientDisconnectedDescription": {
        "en": "Your connection to the game room was unexpectedly closed.",
        "de": "Die Verbindung zum Spielraum wurde unerwartet getrennt.",
        "bg": null
    },
    "roomErrorBackToStart": {
        "en": "Back to Start",
        "de": "Zurück zum Start",
        "bg": null
    },

    "copyInviteLink": {
        "en": "Copy Invitation Link",
        "de": "Einladungslink Kopieren",
        "bg": null
    },
    "inviteLinkCopied": {
        "en": "Copied!",
        "de": "Kopiert!",
        "bg": null,
    },
    "players": {
        "en": "Players",
        "de": "Spieler",
        "bg": null
    },
    "waitingForPlayers": {
        "en": "Waiting for everyone to join and get ready...",
        "de": "Wartet darauf, dass alle Spieler beigetreten und bereit sind...",
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
    },

    "roomSettings": {
        "en": "Room Settings",
        "de": "Raumeinstellungen",
        "bg": null
    },
    "roomSettingVisibility": {
        "en": "Room Visibility",
        "de": "Raumsichtbarkeit",
        "bg": null
    },
    "roomSettingVisibilityValues": {
        "en": ["Private", "Public"],
        "de": ["Privat", "Offen"],
        "bg": [null, null]
    },
    "gameSettings": {
        "en": "Game Settings",
        "de": "Spieleinstellungen",
        "bg": null
    },
    "gameSettingTrainNameLanguage": {
        "en": "Train Name Language",
        "de": "Sprache von Zugnamen",
        "bg": null
    },
    "gameSettingTrainNameLanguageValues": {
        "en": ["🇬🇧", "🇩🇪", "🇧🇬"],
        "de": ["🇬🇧", "🇩🇪", "🇧🇬"],
        "bg": ["🇬🇧", "🇩🇪", "🇧🇬"]
    },
    "gameSettingTrainNameChanges": {
        "en": "Train Name Changes Allowed",
        "de": "Änderungen an Zugnamen Erlaubt",
        "bg": null
    },
    "gameSettingTrainNameChangesValues": {
        "en": ["No", "Yes"],
        "de": ["Nein", "Ja"],
        "bg": [null, null]
    },
    "gameSettingTrainStyles": {
        "en": "Varied Train Styles",
        "de": "Variierte Zugstile",
        "bg": null
    },
    "gameSettingTrainStylesValues": {
        "en": ["No", "Yes"],
        "de": ["Nein", "Ja"],
        "bg": [null, null]
    },
    "gameSettingTrainLength": {
        "en": "Train Length",
        "de": "Zuglänge",
        "bg": null
    },
    "gameSettingTrainLengthValues": {
        "en": ["Short", "Medium", "Long"],
        "de": ["Kurz", "Medium", "Lang"],
        "bg": [null, null, null]
    },

    "chatSendMessage": {
        "en": "Send",
        "de": "Senden",
        "bg": null
    }

});

const selectedLocale = localStorage.selectedLocale || detectLocale() || "en";

function detectLocale() {
    const userLocale = navigator.language || navigator.userLanguage;
    const locale = userLocale.split("-")[0];
    if (!SHORT_LOCALES.includes(locale)) { return undefined; }
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
    for (const e of elements) {
        const key = e.getAttribute("localized");
        if (key !== null) {
            e.innerHTML = getLocalized(key);
        }
        const phKey = e.getAttribute("placeholderLocalized");
        if (phKey !== null) {
            e.setAttribute("placeholder", getLocalized(phKey));
        }
    }
});