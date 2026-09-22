const CONFIG = {
  SHEET_NAME: "",
  HEADER_ROW: 1
};


// Read all sheet data.
function doGet() {
  try {
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();

    if (!values.length) {
      return out_({
        success: true,
        data: []
      });
    }

    const headers = values[CONFIG.HEADER_ROW - 1].map(norm_);

    const rows = values
      .slice(CONFIG.HEADER_ROW)
      .filter(row =>
        row.some(cell =>
          String(cell ?? "").trim() !== ""
        )
      );

    return out_({
      success: true,
      data: normalize_(headers, rows)
    });

  } catch (error) {
    console.error(error);

    return out_({
      success: false,
      error: error.message || "Unable to read Google Sheet"
    });
  }
}


// Add a new entry to the sheet.
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No POST data received.");
    }

    const data = JSON.parse(e.postData.contents || "{}");

    const requiredFields = [
      "date",
      "salesman",
      "particulars",
      "itemDetails",
      "unit"
    ];

    requiredFields.forEach(field => {
      if (!val_(data[field])) {
        throw new Error("Missing required field: " + field);
      }
    });

    const qty = Number(data.qty);

    if (!isFinite(qty) || qty <= 0) {
      throw new Error("Qty must be greater than zero.");
    }

    const price = Number(data.price);

    if (!isFinite(price) || price < 0) {
      throw new Error("Price must be zero or greater.");
    }

    const amount = qty * price;

    const sheet = getSheet_();
    const map = headerMap_(sheet);

    const row = new Array(sheet.getLastColumn()).fill("");

    put_(row, map, ["date"], data.date);

    putOptional_(
      row,
      map,
      ["billno", "vchbillno", "voucherno", "billnumber"],
      data.billNo || ""
    );

    put_(row, map, ["salesman"], data.salesman);

    put_(
      row,
      map,
      ["particulars", "customer", "particularscustomer"],
      data.particulars
    );

    put_(
      row,
      map,
      ["itemdetails", "itemdetail"],
      data.itemDetails
    );

    putOptional_(
      row,
      map,
      ["alias"],
      data.alias || ""
    );

    putOptional_(
      row,
      map,
      ["materialcentre", "materialcenter"],
      data.materialCentre || ""
    );

    put_(
      row,
      map,
      ["qty", "quantity"],
      qty
    );

    put_(
      row,
      map,
      ["unit"],
      data.unit
    );

    put_(
      row,
      map,
      ["price"],
      price
    );

    put_(
      row,
      map,
      ["amount", "totalamount"],
      amount
    );

    sheet.appendRow(row);

    return out_({
      success: true,
      message: "Entry added successfully",
      amount: amount
    });

  } catch (error) {
    console.error(error);

    return out_({
      success: false,
      error: error.message || "Unable to add entry"
    });
  }
}


// Get the configured Google Sheet.
function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("No spreadsheet found.");
  }

  if (CONFIG.SHEET_NAME) {
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error(
        "Sheet not found: " + CONFIG.SHEET_NAME
      );
    }

    return sheet;
  }

  const sheets = spreadsheet.getSheets();

  if (!sheets.length) {
    throw new Error("No sheets found.");
  }

  return sheets[0];
}


// Convert sheet rows into API objects.
function normalize_(headers, rows) {
  return rows.map(row => {
    const values = {};

    headers.forEach((header, index) => {
      if (header && !Object.prototype.hasOwnProperty.call(values, header)) {
        values[header] = row[index];
      }
    });

    return {
      date: formatDate_(
        getValue_(values, ["date"])
      ),

      billNo: string_(
        getValue_(
          values,
          [
            "billno",
            "vchbillno",
            "voucherno",
            "billnumber"
          ]
        )
      ),

      salesman: string_(
        getValue_(values, ["salesman"])
      ),

      particulars: string_(
        getValue_(
          values,
          [
            "particulars",
            "customer",
            "particularscustomer"
          ]
        )
      ),

      itemDetails: string_(
        getValue_(
          values,
          [
            "itemdetails",
            "itemdetail"
          ]
        )
      ),

      alias: string_(
        getValue_(values, ["alias"])
      ),

      materialCentre: string_(
        getValue_(
          values,
          [
            "materialcentre",
            "materialcenter"
          ]
        )
      ),

      qty: number_(
        getValue_(
          values,
          [
            "qty",
            "quantity"
          ]
        )
      ),

      unit: string_(
        getValue_(values, ["unit"])
      ),

      price: number_(
        getValue_(values, ["price"])
      ),

      amount: number_(
        getValue_(
          values,
          [
            "amount",
            "totalamount"
          ]
        )
      )
    };
  });
}


// Create a map of sheet headers.
function headerMap_(sheet) {
  const headers = sheet
    .getRange(
      CONFIG.HEADER_ROW,
      1,
      1,
      sheet.getLastColumn()
    )
    .getValues()[0];

  const map = {};

  headers.forEach((header, index) => {
    const normalized = norm_(header);

    if (
      normalized &&
      !Object.prototype.hasOwnProperty.call(map, normalized)
    ) {
      map[normalized] = index + 1;
    }
  });

  console.log(
    "Detected Sheet Headers: " +
    JSON.stringify(map)
  );

  return map;
}


// Write a required value into the matching column.
function put_(row, map, names, value) {
  for (const name of names) {
    const normalized = norm_(name);

    if (
      Object.prototype.hasOwnProperty.call(
        map,
        normalized
      )
    ) {
      row[map[normalized] - 1] = value;
      return;
    }
  }

  throw new Error(
    "Missing Sheet column: " + names[0]
  );
}


// Write a value only when the column exists.
function putOptional_(row, map, names, value) {
  for (const name of names) {
    const normalized = norm_(name);

    if (
      Object.prototype.hasOwnProperty.call(
        map,
        normalized
      )
    ) {
      row[map[normalized] - 1] = value;
      return;
    }
  }
}


// Get a value using possible header names.
function getValue_(object, names) {
  for (const name of names) {
    const normalized = norm_(name);

    if (
      Object.prototype.hasOwnProperty.call(
        object,
        normalized
      )
    ) {
      return object[normalized];
    }
  }

  return "";
}


// Normalize a header name.
function norm_(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}


// Check whether a value exists.
function val_(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  );
}


// Convert a value to text.
function string_(value) {
  return value == null
    ? ""
    : String(value);
}


// Convert a value to a number.
function number_(value) {
  const number = Number(
    String(value ?? "").replace(/,/g, "")
  );

  return isFinite(number) ? number : 0;
}


// Format Google Sheet dates.
function formatDate_(value) {
  if (
    Object.prototype.toString.call(value) ===
      "[object Date]" &&
    !isNaN(value)
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "dd-MM-yyyy"
    );
  }

  return String(value ?? "");
}


// Return a JSON response.
function out_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(
      ContentService.MimeType.JSON
    );
}