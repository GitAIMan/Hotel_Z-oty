export const CATEGORIES = {
    "HOTEL KOSZTY": [
        "REKLAMA",
        "REKLAMA INTERNETOWA",
        "KOSZTY BIUROWE",
        "REMONTY NAPRAWY",
        "HOTEL KOSZTY INNE",
        "CHEMIA HOTELOWA - PAPIERY",
        "UZUPEŁNIENIE WYPOSAŻENIA",
        "KOSMETYKI HOTELOWE",
        "POŚREDNICTWO PRACY",
        "SZKOLENIA",
        "UNIFORMY",
        "PROFITROOM",
        "Booking",
        "KOSZTY USŁUG FIRM ZEWNĘTRZNYCH MARKETINGU",
        "KOSZTY USŁUG FIRM ZEWNĘTRZNYCH HOTELU",
        "ZWROTY",
        "DEKORACJE"
    ],
    "GASTRONOMIA KOSZTY": [
        "ENERGIA",
        "GAZY TECHNICZNE",
        "TOWARY",
        "DODATKI / PRZYPRAWY / PRODUKTY SYPKIE",
        "MIĘSO",
        "WARZYWA / OWOCE",
        "NAPOJE",
        "KAWA",
        "PIWO",
        "WINO",
        "ALKOHOLE WYSOKOPROCENTOWE",
        "TRANSPORT",
        "KOSZTY BIUROWE",
        "CHEMIA GASTRONOMICZNA - PAPIERY",
        "UZUPEŁNIENIE WYPOSAŻENIA",
        "POŚREDNICTWO PRACY",
        "SZKOLENIA",
        "REMONTY NAPRAWY",
        "KOSMETYKI GASTRONOMII",
        "ZWROTY",
        "KOSZTY INNYCH USŁUG ZEWNĘTRZNYCH"
    ],
    "SPA KOSZTY": [
        "UNIFORMY",
        "KOSZTY BIUROWE",
        "KOSMETYKI SPA",
        "CHEMIA SPA",
        "UZUPEŁNIENIE WYPOSAŻENIA SPA",
        "ZWROTY",
        "REMONTY NAPRAWY",
        "KOSZTY USŁUG FIRM ZEWNĘTRZNYCH SPA"
    ],
    "KOSZTY OGÓLNE": [
        "MEDIA",
        "DOSTĘP DO INTERNETU",
        "TELEWIZJA",
        "TELEFONY / KARTY SIM",
        "OCHRONA / MONITORING",
        "ODPADY",
        "UBEZPIECZENIA",
        "OPROGRAMOWANIE",
        "ENERGIA",
        "USŁUGI FINANSOWE / BANKOWE",
        "LEASING",
        "OPŁATY / ABONAMENTY",
        "SKŁADKI / OPŁATY",
        "USŁUGI KSIĘGOWE",
        "USŁUGI PRAWNE",
        "DERATYZACJA / DEZYNSEKCJA / ODŚNIEŻANIE / PIELĘGNACJA OGRODU",
        "KOSZTY ADMINISTRACYJNE",
        "INNE USŁUGI ZWIĄZANE Z ZARZĄDZANIEM",
        "UTRZYMANIE CZYSTOŚCI - PARKING",
        "USŁUGI TRANSPORTOWE",
        "ZWROT GOTÓWKI ZA PALIWO"
    ],
    "SZEF, INWESTYCJE": [
        "ZAKUPY INWESTYCYJNE",
        "PROGRAMY / OPROGRAMOWANIE",
        "PROJEKTY",
        "POŻYCZKI",
        "DYWIDENDY",
        "KOSZTY KSIĘGOWE",
        "KOSZTY PRAWNE",
        "KOSZTY ADMINISTRACYJNE",
        "ROZLICZENIA",
        "ROZLICZENIA ZUS",
        "PODATKI"
    ]
};

// Helper to get a flat list of all categories for searching
// Returns array of objects: { value: "Category Name", group: "Group Name" }
export const getFlatCategories = () => {
    const flatList = [];
    Object.entries(CATEGORIES).forEach(([group, items]) => {
        items.forEach(item => {
            flatList.push({
                value: item,
                group: group,
                label: `${item} (${group})`
            });
        });
    });
    return flatList;
};
