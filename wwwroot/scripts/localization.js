
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
        "bg": `...е браузър-базирана парти игра за управление на влакове на моделна железница.
 Ще работите ли заедно, за да увеличите максимално точките, или ще се заблуждавате взаимно, за да получите предимство?`
    },

    "createPrivateRoom": {
        "en": "Create Private Room",
        "de": "Privaten Raum Erstellen",
        "bg": "Създай затворена стая"
    },
    "joinPublicRoom": {
        "en": "Join Public Room",
        "de": "Öffentlichem Raum Beitreten",
        "bg": "Влез в отворена стая",
    },
    "joinRoomByCode": {
        "en": "Join (Code)",
        "de": "Beitreten (Code)",
        "bg": "Влез (код)"
    },
    "roomCreationFailed": {
        "en": "Failed to create a room. Please try again.",
        "de": "Konnte keinen Raum erstellen. Bitte erneut versuchen.",
        "bg": "Създаването на стая не бе успешно. Моля, опитайте отново."
    },
    "roomCreationCooldown": {
        "en": "Please wait before creating another room.",
        "de": "Bitte warten Sie, bevor sie erneut einen Raum erstellen.",
        "bg": "Моля, изчакайте, преди да създадете друга стая."
    },
    "invalidJoinCode": {
        "en": "The given room code is incorrect. Please try again.",
        "de": "Der Raumcode ist inkorrekt. Bitte erneut versuchen.",
        "bg": "Даденият код на стаята е неправилен. Моля, опитайте отново."
    },

    "joinRoom": {
        "en": "Join Room",
        "de": "Raum Beitreten",
        "bg": "Влез в стаята"
    },
    "enterNicknamePrompt": {
        "en": `Choose a nickname under which to join the room.
 Please choose a name that is respectful and appropriate, as it will be visible to other players.`,
        "de": `Wählen Sie einen Spitznamen, unter dem Sie dem Raum beitreten möchten.
 Bitte wählen Sie einen respektvollen und angemessenen Namen, da dieser für andere Spieler sichtbar sein wird.`,
        "bg": `Изберете име, с който да се присъедините към стаята.
 Моля, изберете име, което е уважително и подходящо, тъй като ще бъде видимо за другите играчи.`
    },
    "usernameInput": {
        "en": "Enter Nickname",
        "de": "Nickname Eingeben",
        "bg": "Въведете име"
    },

    "unknownRoomTitle": {
        "en": "Room Closed :(",
        "de": "Raum Geschlossen :(",
        "bg": "Стаята е затворена :("
    },
    "unknownRoomDescription": {
        "en": `The room you attempted to join no longer exists.
 Please create or join another room.`,
        "de": `Dieser Raum existiert nicht mehr.
 Bitte erstelle oder trete einem anderen Raum bei.`,
        "bg": `Стаята, в която се опитахте да влезете, вече не съществува.
 Моля, създайте или влезте в друга стая.`
    },
    "roomFullTitle": {
        "en": "Room Full :(",
        "de": "Raum Voll :(",
        "bg": "Стаята е пълна :("
    },
    "roomFullDescription": {
        "en": `The room you attempted to join is full.
 Please try again later or join another room.`,
        "de": `Dieser Raum ist voll. Bitte versuche es später erneut oder
 trete einem anderem Raum bei.`,
        "bg": `Стаята, в която се опитахте да влезете, е пълна.
 Моля, опитайте отново по-късно или влезте в друга стая.`
    },
    "roomCrashTitle": {
        "en": "The Room Crashed :(",
        "de": "Der Raum ist Abgestürzt :(",
        "bg": "В стаята възникна грешка :("
    },
    "roomCrashDescription": {
        "en": `The room you were in encountered a critical error and had to be
 closed. This is not supposed to happen, so it would be greatly appreciated if
 you could file an issue
 <a href="https://github.com/schwalbe-t/linton_railway/issues">on the Linton Railway Github</a>
 describing what happened prior to the crash occuring.`,
        "de": `In deinem Raum ist ein kritischer Fehler aufgetreten und er musste
 geschlossen werden. Da dies nicht normal ist wären wir dir sehr dankbar, wenn du
 das Problem 
 <a href="https://github.com/schwalbe-t/linton_railway/issues">im Linton Railway Github</a>
 melden könntest und beschreiben würdest, was vor dem Absturz passiert ist.`,
        "bg": `В стаята, в която се намирахте, възникна критична грешка и трябваше
 да бъде затворена. Това не би трябвало да се случва, така че ще бъдем много
 благодарни, ако можете да подадете съобщение за проблем
 <a href="https://github.com/schwalbe-t/linton_railway/issues">в Github на Линтън Рейлуей</a>
, описвайки какво се е случило преди възникването на грешката.`
    },
    "clientDisconnectedTitle": {
        "en": "You were disconnected :(",
        "de": "Verbindung getrennt :(",
        "bg": "Връзката беше прекъсната :(",
    },
    "clientDisconnectedDescription": {
        "en": `Your connection to the game room was unexpectedly closed.
 <b>You should be automatically reconnected in a few seconds.</b>`,
        "de": `Die Verbindung zum Spielraum wurde unerwartet getrennt.
 <b>Du solltest nach einigen Sekunden automatisch erneut verbunden werden.</b>`,
        "bg": `Връзката ви с игралната стая неочаквано прекъсна.
 <b>Трябва автоматично да се свържете отново след няколко секунди.</b>`
    },
    "roomErrorBackToStart": {
        "en": "Back to Start",
        "de": "Zurück zum Start",
        "bg": "Към началната страница"
    },

    "copyInviteLink": {
        "en": "Copy Invitation Link",
        "de": "Einladungslink Kopieren",
        "bg": "Копирай линка за поканата"
    },
    "inviteLinkCopied": {
        "en": "Copied!",
        "de": "Kopiert!",
        "bg": "Копирано!",
    },
    "players": {
        "en": "Players",
        "de": "Spieler",
        "bg": "Играчи"
    },
    "waitingForPlayers": {
        "en": "Waiting for everyone to join and get ready...",
        "de": "Wartet darauf, dass alle Spieler beigetreten und bereit sind...",
        "bg": "Изчакване всички да влязат и да са готови..."
    },
    "playerNotReady": {
        "en": "Not Ready",
        "de": "Nicht Bereit",
        "bg": "Не е готов"
    },
    "playerReady": {
        "en": "Ready",
        "de": "Bereit",
        "bg": "Готов"
    },
    "getReady": {
        "en": "I Am Ready",
        "de": "Ich Bin Bereit",
        "bg": "Готово"
    },
    "showInviteCode": {
        "en": "Show Invitation Code",
        "de": "Einladungscode Zeigen",
        "bg": "Покажи кода за покана"
    },

    "roomSettings": {
        "en": "Room Settings",
        "de": "Raumeinstellungen",
        "bg": "Настройки на стаята"
    },
    "roomSettingVisibility": {
        "en": "Room Visibility",
        "de": "Raumsichtbarkeit",
        "bg": "Достъп до стаята"
    },
    "roomSettingVisibilityValues": {
        "en": ["Private", "Public"],
        "de": ["Privat", "Offen"],
        "bg": ["Затворен", "Отворен"]
    },
    "gameSettings": {
        "en": "Game Settings",
        "de": "Spieleinstellungen",
        "bg": "Настройки на играта"
    },
    "gameSettingTrainNameLanguage": {
        "en": "Train Name Language",
        "de": "Sprache von Zugnamen",
        "bg": "Език на имената на влаковете"
    },
    "gameSettingTrainNameLanguageValues": {
        "en": ["🇬🇧", "🇩🇪", "🇧🇬"],
        "de": ["🇬🇧", "🇩🇪", "🇧🇬"],
        "bg": ["🇬🇧", "🇩🇪", "🇧🇬"]
    },
    "gameSettingTrainNameChanges": {
        "en": "Train Name Changes Allowed",
        "de": "Änderungen an Zugnamen Erlaubt",
        "bg": "Позволена промяна на имената"
    },
    "gameSettingTrainNameChangesValues": {
        "en": ["No", "Yes"],
        "de": ["Nein", "Ja"],
        "bg": ["Не", "Да"]
    },
    "gameSettingTrainStyles": {
        "en": "Varied Train Styles",
        "de": "Variierte Zugstile",
        "bg": "Разнообразни стилове на влаковете"
    },
    "gameSettingTrainStylesValues": {
        "en": ["No", "Yes"],
        "de": ["Nein", "Ja"],
        "bg": ["Не", "Да"]
    },
    "gameSettingTrainLength": {
        "en": "Train Length",
        "de": "Zuglänge",
        "bg": "Дължина на влаковете"
    },
    "gameSettingTrainLengthValues": {
        "en": ["Short", "Medium", "Long"],
        "de": ["Kurz", "Medium", "Lang"],
        "bg": ["Къси", "Средни", "Дълги"]
    },

    "chatSendMessage": {
        "en": "Send",
        "de": "Senden",
        "bg": "Изпрати"
    },
    "chatDisclaimer": {
        "en": "Please keep the chat respectful and fun for everyone.",
        "de": "Bitte halte den Chat für alle respektvoll und unterhaltsam.",
        "bg": "Моля, поддържайте чата уважителен и забавен за всички."
    },

    "pointCounterText": {
        "en": "Points",
        "de": "Punkte",
        "bg": "Точки"
    },
    "gameResultsTitle": {
        "en": "Game Results",
        "de": "Splielergebnis",
        "bg": "Резултати на играта"
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