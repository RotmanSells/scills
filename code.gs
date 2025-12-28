function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  // Try to get a lock for 10 seconds to prevent concurrent edits messing up the sheet
  lock.tryLock(10000);
  
  try {
    let action = '';
    let data = {};

    // Determine if it's GET or POST and parse data accordingly
    if (e.parameter && e.parameter.action) {
      action = e.parameter.action;
      // Parse GET parameters
      for (let key in e.parameter) {
        if (key !== 'action') {
          try {
            data[key] = JSON.parse(e.parameter[key]);
          } catch (err) {
            data[key] = e.parameter[key];
          }
        }
      }
    } else if (e.postData && e.postData.contents) {
      const postData = JSON.parse(e.postData.contents);
      action = postData.action;
      data = postData;
    }

    if (!action) {
       return ContentService.createTextOutput(JSON.stringify({
        status: 'success', 
        message: 'Salon API Ready'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = handleAction(action, data, ss);
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function handleAction(action, data, ss) {
  switch(action) {
    case 'syncAll': // Single call to get everything for fast load
      return {
        success: true,
        data: {
          bookings: getBookingsData(ss),
          procedures: getProceduresData(ss),
          clients: getClientsData(ss),
          settings: getSettingsData(ss)
        }
      };

    case 'getBookings':
      return { success: true, data: getBookingsData(ss) };
      
    case 'createBooking':
      return { success: true, data: createBookingData(ss, data) };
      
    case 'updateBooking':
      return { success: true, data: updateBookingData(ss, data) };
      
    case 'deleteBooking':
      deleteBookingData(ss, data.id);
      return { success: true, id: data.id };
      
    case 'updateProcedures':
      updateProceduresData(ss, data.procedures);
      return { success: true };
      
    case 'updateClients': // Bulk update/replace for settings text area
      updateClientsData(ss, data.clients);
      return { success: true };
      
    case 'updateSettings':
      updateSettingsData(ss, data.settings);
      return { success: true };
      
    default:
      return { success: false, error: 'Unknown action: ' + action };
  }
}

// --- Data Helpers ---

function getBookingsData(ss) {
  const sheet = getOrCreateSheet(ss, 'Записи', ['id', 'date', 'time', 'serviceType', 'procedure', 'phone', 'status', 'createdAt', 'clientName']);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function createBookingData(ss, data) {
  const sheet = getOrCreateSheet(ss, 'Записи', ['id', 'date', 'time', 'serviceType', 'procedure', 'phone', 'status', 'createdAt', 'clientName']);
  const id = data.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9); // Allow frontend ID for optimistic UI
  const createdAt = new Date().toISOString();
  
  const rowData = [
    id, data.date, data.time, data.serviceType, 
    data.procedure, data.phone, 'active', createdAt, data.clientName || ''
  ];
  
  sheet.appendRow(rowData);
  
  return {
    id, date: data.date, time: data.time, serviceType: data.serviceType,
    procedure: data.procedure, phone: data.phone, status: 'active', 
    createdAt, clientName: data.clientName || ''
  };
}

function updateBookingData(ss, data) {
  const sheet = ss.getSheetByName('Записи');
  if (!sheet) throw new Error('Sheet missing');
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf('id');
  
  // Backward loop for performance (assuming recent bookings are at the bottom usually, but standard loop is fine)
  for (let i = 1; i < values.length; i++) {
    if (values[i][idIndex] == data.id) {
      Object.keys(data.updates).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(data.updates[key]);
        }
      });
      return data.updates;
    }
  }
  return null;
}

function deleteBookingData(ss, id) {
  const sheet = ss.getSheetByName('Записи');
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  const idIndex = values[0].indexOf('id');
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][idIndex] == id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function getProceduresData(ss) {
  const mSheet = getOrCreateSheet(ss, 'Процедуры_Массаж', ['id', 'name', 'duration', 'type']);
  const lSheet = getOrCreateSheet(ss, 'Процедуры_Лазер', ['id', 'name', 'duration', 'type']);
  return {
    massage: getSheetDataAsObjects(mSheet),
    laser: getSheetDataAsObjects(lSheet)
  };
}

function updateProceduresData(ss, procedures) {
  if (procedures.massage) replaceSheetData(ss, 'Процедуры_Массаж', procedures.massage, ['id', 'name', 'duration', 'type']);
  if (procedures.laser) replaceSheetData(ss, 'Процедуры_Лазер', procedures.laser, ['id', 'name', 'duration', 'type']);
}

function getClientsData(ss) {
  const sheet = getOrCreateSheet(ss, 'Клиенты', ['phone', 'name', 'rawString']);
  return getSheetDataAsObjects(sheet);
}

function updateClientsData(ss, clientsList) {
  // clientsList is array of objects {phone, name, rawString}
  replaceSheetData(ss, 'Клиенты', clientsList, ['phone', 'name', 'rawString']);
}

function getSettingsData(ss) {
  const sheet = getOrCreateSheet(ss, 'Настройки', ['key', 'value']);
  const data = sheet.getDataRange().getValues();
  const settings = { workStart: '10:00', workEnd: '22:00' }; // Defaults
  
  for (let i = 1; i < data.length; i++) {
    const [k, v] = data[i];
    if (k) settings[k] = v;
  }
  return settings;
}

function updateSettingsData(ss, settings) {
  const sheet = getOrCreateSheet(ss, 'Настройки', ['key', 'value']);
  sheet.clearContents();
  sheet.appendRow(['key', 'value']);
  Object.entries(settings).forEach(([k, v]) => {
    sheet.appendRow([k, v]);
  });
}

// --- Utils ---

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function getSheetDataAsObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function replaceSheetData(ss, sheetName, dataObjects, headers) {
  const sheet = getOrCreateSheet(ss, sheetName, headers);
  // Clear all except headers
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }
  
  if (dataObjects && dataObjects.length > 0) {
    const rows = dataObjects.map(obj => headers.map(h => obj[h] || ''));
    // Bulk write is faster
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

