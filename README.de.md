# SyncStone - Stardustmemoir Chrome-Erweiterung

SyncStone, benannt "Stardustmemoir", ist ein inoffizielles Tool für FINAL FANTASY XIV. Diese Erweiterung funktioniert als eigenständige Chrome-Erweiterung, die entwickelt wurde, um Ihre Tagebucheinträge von The Lodestone (der offiziellen Spielerseite von FINAL FANTASY XIV) im Markdown-Format für die lokale Speicherung zu exportieren. Da The Lodestone keine Exportfunktion bietet, ist das Hauptziel, Ihnen beim Sichern Ihrer wertvollen Erinnerungen zu helfen.

<p align="center">
  <img src="28445b1c091759ab82531cc3a64b5ca7ced45c89.jpg" alt="kako-jun">
</p>

## Funktionen

*   **Einzelnen Artikel exportieren**: Exportiert die aktuelle Lodestone-Tagebuchartikelseite oder Tagebuchbearbeitungsseite, einschließlich des Artikeltitels, des Textkörpers, aller Bilder (interne und externe), der Kommentare, der Likes, des Veröffentlichungsdatums und der Tags. Es wird eine ZIP-Datei heruntergeladen, die die Markdown-Datei und die zugehörigen Bilder enthält.
*   **Alle Artikel exportieren**: Exportiert alle Tagebucheinträge von der Lodestone-Tagebuchlistenseite, einschließlich Artikeltitel, Textkörper, aller Bilder (interne und externe), Kommentare, Likes, Veröffentlichungsdaten und Tags. Es konvertiert sie in das Markdown-Format und lädt sie als einheitliche ZIP-Datei herunter, die sowohl Artikel als auch Bilder enthält. Alle Bilder werden heruntergeladen und in einem `images/`-Ordner innerhalb der ZIP-Datei abgelegt.
*   **Kommentar-Abruf**: Ruft den vollständigen Text der Kommentare zu Artikeln ab und fügt sie in die Markdown-Dateien ein.
*   **Massen-Bild-Download**: Beim Exportieren aller Artikel werden alle Bilder von der Bildverwaltungsseite von The Lodestone vorab heruntergeladen und in die ZIP-Datei aufgenommen. Dies verhindert doppelte Downloads von Bildern, die in mehreren Artikeln referenziert werden, und stellt sicher, dass Bilder bei der lokalen Anzeige korrekt angezeigt werden.
*   **Artikellisten-Generierung**: Beim Exportieren aller Artikel wird eine `Article_List.md`-Datei in der ZIP-Datei generiert, die Links zu allen exportierten Artikeln enthält. Diese Datei kann bequem als Sammlung von Links zu Ihren exportierten Artikeln verwendet werden, wenn sie mit Markdown-Vorschau-fähigen Texteditoren wie [Visual Studio Code](https://code.visualstudio.com/) geöffnet wird.

## Installation

1.  Klonen oder [laden Sie](https://github.com/kako-jun/sync-stone/archive/refs/heads/main.zip) dieses Repository herunter.
2.  Öffnen Sie den Chrome-Browser und navigieren Sie zu `chrome://extensions`.
3.  Schalten Sie den "Entwicklermodus" oben rechts ein.
4.  Klicken Sie auf die Schaltfläche "Entpackte Erweiterung laden".
5.  Wählen Sie den Ordner `chrome-extension` innerhalb des heruntergeladenen oder geklonten Repositorys aus.
6.  Die SyncStone-Erweiterung wird zu Chrome hinzugefügt.

## Verwendung

### 1. Zugriffsintervall einstellen

Wenn Sie das Popup der Erweiterung öffnen, finden Sie ein Eingabefeld für "Zugriffsintervall". Dies legt die Wartezeit (in Millisekunden) zwischen aufeinanderfolgenden Zugriffen auf den Server von The Lodestone fest. Um die Serverlast zu berücksichtigen, ist der Standardwert auf 2000 Millisekunden (2 Sekunden) eingestellt und kann nicht unter 2000 Millisekunden liegen. Passen Sie ihn bei Bedarf an.

### 2. Exportieren eines einzelnen Artikels

1.  Öffnen Sie die Lodestone-Tagebuchartikelseite (z.B. `https://jp.finalfantasyxiv.com/lodestone/character/YOUR_CHARACTER_ID/blog/ARTICLE_ID/`), die Sie exportieren möchten.
2.  Klicken Sie auf das SyncStone-Symbol in Ihrer Chrome-Symbolleiste, um das Popup zu öffnen.
3.  Klicken Sie auf die Schaltfläche "Export Current Article".
4.  Eine ZIP-Datei mit der Markdown-Datei und den Bildern wird heruntergeladen.

### 3. Exportieren aller Artikel

1.  Öffnen Sie die Lodestone-Tagebuchlistenseite (z. B. `https://jp.finalfantasyxiv.com/lodestone/character/YOUR_CHARACTER_ID/blog/`).
2.  Klicken Sie auf das SyncStone-Symbol in Ihrer Chrome-Symbolleiste, um das Popup zu öffnen.
3.  Klicken Sie auf die Schaltfläche "Export All Articles".
4.  Ein Bestätigungsdialog wird angezeigt, der die Anzahl der zu exportierenden Artikel anzeigt und Sie fragt, ob Sie fortfahren möchten. Klicken Sie auf "Ja", um den Export zu starten.
5.  Während des Exports wird ein Fortschrittsbalken angezeigt. Nach Abschluss wird eine ZIP-Datei heruntergeladen.

### 4. Exportieren von Artikeln anderer Spieler (Versteckte Funktion)

**Wichtig**: Diese Funktion wird unter der Erwartung einer angemessenen Nutzung bereitgestellt.

SyncStone kann auch Tagebucheinträge anderer Spieler mit demselben Verfahren exportieren. Dies ist in folgenden Situationen wertvoll:

- **Bewahrung von Erinnerungen, die durch Kontolöschung verloren gehen würden**: Wenn Freunde FFXIV vollständig verlassen, werden ihre Tagebücher unzugänglich. Sie können die Aufzeichnungen gemeinsamer Abenteuer und wertvoller Erinnerungen bewahren, damit sie nicht verloren gehen.
- **Aufzeichnung gemeinsamer Erfahrungen**: Gemeinsam abgeschlossene Aktivitäten, gemeinsam besuchte Events und andere geteilte Erinnerungen können als Aufzeichnungen bewahrt werden.

**Verwendung**:
1. Öffnen Sie die Tagebuchlistenseite des anderen Spielers, dessen Artikel Sie exportieren möchten
2. Folgen Sie demselben Verfahren wie für Ihre eigenen Artikel und klicken Sie auf "Export All Articles"
3. Das System erkennt automatisch, dass es sich um Artikel eines anderen Spielers handelt und verarbeitet sie entsprechend

**Technische Unterschiede**:
- Bei Artikeln anderer Spieler sind die Bildergalerieseiten nicht zugänglich, daher werden nur Bilder heruntergeladen, die in den Artikeln enthalten sind
- Die exportierte ZIP-Datei wird `lodestone_others_complete_export.zip` genannt, um sie von Ihren eigenen Artikeln (`lodestone_complete_export.zip`) zu unterscheiden

**Nutzungsrichtlinien**:
- Bitte verwenden Sie diese Funktion für den legitimen Zweck der Bewahrung von Erinnerungen
- Bitte respektieren Sie die Privatsphäre und verwenden Sie sie in angemessenen Grenzen

### 5. Exportierte Dateien

Die heruntergeladene ZIP-Datei enthält Folgendes:

*   **Markdown-Dateien (`.md`)**: Jeder Artikel wird als separate Markdown-Datei gespeichert. Der Dateiname wird im Format `001_Artikeltitel.md` mit einem sequenziellen ID-Präfix zur Vermeidung von Duplikaten sein.
    *   Der Anfang jeder Markdown-Datei enthält die folgenden Metadaten im YAML-Frontmatter-Format:
        *   `title`: Artikeltitel
        *   `date`: Veröffentlichungsdatum
        *   `likes`: Anzahl der Likes
        *   `comments`: Anzahl der Kommentare
        *   `tags`: Liste der Tags
    *   Der Artikeltext und der Kommentartext werden im Markdown-Format vorliegen.
*   **`images/`-Ordner**: Interne Lodestone-Bilder (Bilder der Domain `finalfantasyxiv.com`) werden heruntergeladen und in diesem Ordner gespeichert. Bildlinks in Markdown-Dateien werden in relative Pfade innerhalb dieses Ordners umgeschrieben.
*   **`index.md`**: Eine Markdown-Datei, die Links zu allen exportierten Artikeln enthält. Diese Datei kann bequem als Sammlung von Links zu Ihren exportierten Artikeln verwendet werden, wenn sie mit Markdown-Vorschau-fähigen Texteditoren wie [Visual Studio Code](https://code.visualstudio.com/) geöffnet wird.

### 6. Anzeigen exportierter Markdown-Dateien

Es wird empfohlen, die exportierten Markdown-Dateien mit einem Texteditor zu öffnen, der eine Markdown-Vorschau unterstützt, wie z. B. [Visual Studio Code](https://code.visualstudio.com/). Stellen Sie sicher, dass die ZIP-Datei entpackt ist und sich die Markdown-Dateien und der `images/`-Ordner im selben Verzeichnis befinden. Dadurch werden Bilder in der Markdown-Vorschau korrekt angezeigt.

## Wichtige Hinweise

*   **Serverlast**: Die Funktion "Alle Artikel exportieren" greift nacheinander auf den Server von The Lodestone zu. Bitte stellen Sie das konfigurierbare Zugriffsintervall entsprechend ein, um eine übermäßige Belastung des Servers zu vermeiden.
*   **Externe Bilder**: Bilder von anderen Domains als The Lodestone werden nicht heruntergeladen und bleiben mit ihren ursprünglichen URLs in den Markdown-Dateien verknüpft.
*   **Änderungen der Lodestone-Spezifikationen**: Wenn sich die HTML-Struktur oder die Spezifikationen von The Lodestone ändern, funktioniert diese Erweiterung möglicherweise nicht mehr korrekt.
*   **BBCode-Konvertierung**: Der BBCode von Lodestone wird als konvertiertes HTML abgerufen und dann von der Turndown-Bibliothek in Markdown konvertiert. Spezielle Notationen oder komplexe Layouts werden möglicherweise nicht perfekt reproduziert.

## Technische Spezifikationen

*   **Entwickelt in TypeScript**: In TypeScript entwickelt, um Codewartbarkeit und Typsicherheit zu verbessern.
*   **Chrome Extension Manifest V3-kompatibel**: Vollständig kompatibel mit den neuesten Chrome-Erweiterungsstandards.
*   **Build-System**: Verwendet Vite für schnelle Entwicklung und Produktions-Builds.
*   **Dynamisches Timeout-Management**: Alle Timeouts werden dynamisch basierend auf den Zugriffsintervall-Einstellungen des Benutzers berechnet, um konsistentes Verhalten zu gewährleisten.
*   **IndexedDB-Speicher**: Verwendet IndexedDB für effizientes Bilddatenmanagement und vermeidet Chrome Service Worker-Speicherbegrenzungen.
*   **Streaming-ZIP-Generierung**: Nutzt zip.js für Streaming-ZIP-Erstellung, ermöglicht stabile Verarbeitung großer Bilddatenmengen ohne Speicherfehler.

<div style="text-align: right; margin-top: 20px;">
  <div style="display: inline-block; vertical-align: middle; margin-right: 20px;">
    <img src="e6486e2b222ab797036f2c3b5bc9d4d850d052d9.jpg" alt="Thank you FFXIV" width="120">
  </div>
  <div style="display: inline-block; vertical-align: middle;">
    <p style="margin:0; padding:0; font-size:1.2em;">Danke, FFXIV</p>
  </div>
</div>