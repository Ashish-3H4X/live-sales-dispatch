# Sales / Dispatch Register

This version is styled to closely match the supplied reference UI: navy header, compact filter bar, salesman summary, amount chart, inline Add New Entry form, and a dense MIS records table.

## Stack
- HTML5
- CSS3
- Vanilla JavaScript
- Chart.js
- Google Sheets
- Google Apps Script Web App

## Setup
1. Open the target Google Sheet.
2. Extensions → Apps Script.
3. Paste `apps-script/Code.gs`.
4. Save and deploy as Web app.
5. Execute as: Me.
6. Who has access: Anyone with the link.
7. Copy the `/exec` URL.
8. Put it into `script.js`:
```js
const CONFIG={API_URL:"YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL",REFRESH_INTERVAL:20000,ROWS_PER_PAGE:10};
```
9. Run locally with VS Code Live Server or:
```bash
python -m http.server 5500
```

The Sheet remains the source of truth. Apps Script normalizes blank continuation fields on read and calculates Amount server-side on POST.
