function doGet(e) {
  // Для проверки работы API
  if (!e || !e.parameter || !e.parameter.action) {
    return HtmlService.createHtmlOutput('<h1>Salon API Ready</h1>');
  }
  
  // Обработка GET запросов (для CORS обхода)
  try {
    const action = e.parameter.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Преобразуем параметры GET запроса в формат, совместимый с handleAction
    const data = {};
    for (let key in e.parameter) {
      if (key !== 'action') {
        try {
          // Пытаемся распарсить JSON, если это объект
          data[key] = JSON.parse(e.parameter[key]);
        } catch (e) {
          // Если не JSON, используем как есть
          data[key] = e.parameter[key];
        }
      }
    }
    
    let result = handleAction(action, data, ss);
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    let result = handleAction(action, data, ss);
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Общая функция обработки действий
function handleAction(action, data, ss) {
  switch(action) {
    case 'getBookings':
      return {
        success: true,
        data: getBookingsData(ss)
      };
      
    case 'createBooking':
      return {
        success: true,
        data: createBookingData(ss, data)
      };
      
    case 'updateBooking':
      return {
        success: true,
        data: updateBookingData(ss, data)
      };
      
    case 'deleteBooking':
      deleteBookingData(ss, data.id);
      return {
        success: true
      };
      
    case 'getProcedures':
      return {
        success: true,
        data: getProceduresData(ss)
      };
      
    case 'updateProcedures':
      updateProceduresData(ss, data.procedures);
      return {
        success: true
      };
      
    case 'getClients':
      return {
        success: true,
        data: getClientsData(ss)
      };
      
    case 'addClients':
      return {
        success: true,
        data: addClientsData(ss, data.phones)
      };
      
    case 'deleteClient':
      deleteClientData(ss, data.id);
      return {
        success: true
      };
      
    case 'getSettings':
      return {
        success: true,
        data: getSettingsData(ss)
      };
      
    case 'updateSettings':
      updateSettingsData(ss, data.settings);
      return {
        success: true,
        data: data.settings
      };
      
    default:
      return {
        success: false,
        error: 'Unknown action'
      };
  }
}

// Функции для работы с данными
function getBookingsData(ss) {
  const sheet = ss.getSheetByName('Записи');
  if (!sheet || sheet.getLastRow() === 0) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // Нет данных кроме заголовков
  
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });
}

function createBookingData(ss, data) {
  let sheet = ss.getSheetByName('Записи');
  if (!sheet) {
    sheet = ss.insertSheet('Записи');
    sheet.appendRow(['id', 'date', 'time', 'serviceType', 'procedure', 'phone', 'status', 'createdAt']);
  }
  
  // Проверяем наличие заголовков
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'date', 'time', 'serviceType', 'procedure', 'phone', 'status', 'createdAt']);
  }
  
  const id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
  const createdAt = new Date().toISOString();
  const row = [
    id,
    data.date,
    data.time,
    data.serviceType,
    data.procedure,
    data.phone,
    'active',
    createdAt
  ];
  sheet.appendRow(row);
  
  return {
    id: id,
    date: data.date,
    time: data.time,
    serviceType: data.serviceType,
    procedure: data.procedure,
    phone: data.phone,
    status: 'active',
    createdAt: createdAt
  };
}

function updateBookingData(ss, data) {
  const sheet = ss.getSheetByName('Записи');
  if (!sheet) {
    throw new Error('Лист "Записи" не найден');
  }
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  if (values.length < 2) {
    throw new Error('Запись не найдена');
  }
  
  const headers = values[0];
  const idCol = headers.indexOf('id');
  
  if (idCol === -1) {
    throw new Error('Столбец "id" не найден');
  }
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] === data.id) {
      Object.keys(data.updates).forEach(key => {
        const col = headers.indexOf(key);
        if (col !== -1) {
          sheet.getRange(i + 1, col + 1).setValue(data.updates[key]);
        }
      });
      return data.updates;
    }
  }
  
  throw new Error('Запись не найдена');
}

function deleteBookingData(ss, id) {
  const sheet = ss.getSheetByName('Записи');
  if (!sheet) return;
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  if (values.length < 2) return;
  
  const headers = values[0];
  const idCol = headers.indexOf('id');
  
  if (idCol === -1) return;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] === id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function getProceduresData(ss) {
  const massageSheet = ss.getSheetByName('Процедуры_Массаж');
  const laserSheet = ss.getSheetByName('Процедуры_Лазер');
  
  return {
    massage: getProceduresFromSheet(massageSheet),
    laser: getProceduresFromSheet(laserSheet)
  };
}

function getProceduresFromSheet(sheet) {
  if (!sheet || sheet.getLastRow() === 0) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // Нет данных кроме заголовков
  
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });
}

function updateProceduresData(ss, procedures) {
  updateProceduresSheet(ss, 'Процедуры_Массаж', procedures.massage || []);
  updateProceduresSheet(ss, 'Процедуры_Лазер', procedures.laser || []);
}

function updateProceduresSheet(ss, sheetName, procedures) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['id', 'name', 'duration']);
  }
  
  // Очищаем данные, но сохраняем заголовки
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  // Если заголовков нет, добавляем их
  if (lastRow === 0) {
    sheet.appendRow(['id', 'name', 'duration']);
  }
  
  // Добавляем процедуры
  procedures.forEach(p => {
    sheet.appendRow([p.id || '', p.name || '', p.duration || 0]);
  });
}

function getClientsData(ss) {
  const sheet = ss.getSheetByName('Клиенты');
  if (!sheet || sheet.getLastRow() === 0) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // Нет данных кроме заголовков
  
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });
}

function addClientsData(ss, phones) {
  let sheet = ss.getSheetByName('Клиенты');
  if (!sheet) {
    sheet = ss.insertSheet('Клиенты');
    sheet.appendRow(['id', 'phone', 'name']);
  }
  
  // Проверяем наличие заголовков
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'phone', 'name']);
  }
  
  const newClients = phones.map(phone => {
    const id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    return {
      id: id,
      phone: phone,
      name: ''
    };
  });
  
  newClients.forEach(client => {
    sheet.appendRow([client.id, client.phone, client.name]);
  });
  
  return newClients;
}

function deleteClientData(ss, id) {
  const sheet = ss.getSheetByName('Клиенты');
  if (!sheet) return;
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  if (values.length < 2) return;
  
  const headers = values[0];
  const idCol = headers.indexOf('id');
  
  if (idCol === -1) return;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] === id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function getSettingsData(ss) {
  const sheet = ss.getSheetByName('Настройки');
  if (!sheet || sheet.getLastRow() === 0) {
    return { workStart: '09:00', workEnd: '21:00', breaks: [] };
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { workStart: '09:00', workEnd: '21:00', breaks: [] };
  }
  
  const settings = {};
  
  // Пропускаем заголовки (первая строка) и обрабатываем данные
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];
    if (key) {
      if (key === 'breaks') {
        try {
          settings[key] = JSON.parse(value || '[]');
        } catch (e) {
          settings[key] = [];
        }
      } else {
        settings[key] = value || '';
      }
    }
  }
  
  return {
    workStart: settings.workStart || '09:00',
    workEnd: settings.workEnd || '21:00',
    breaks: settings.breaks || []
  };
}

function updateSettingsData(ss, settings) {
  let sheet = ss.getSheetByName('Настройки');
  if (!sheet) {
    sheet = ss.insertSheet('Настройки');
    sheet.appendRow(['key', 'value']);
  }
  
  // Очищаем данные, но сохраняем заголовки
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  // Если заголовков нет, добавляем их
  if (lastRow === 0) {
    sheet.appendRow(['key', 'value']);
  }
  
  // Добавляем настройки
  Object.keys(settings).forEach(key => {
    const value = key === 'breaks' ? JSON.stringify(settings[key]) : settings[key];
    sheet.appendRow([key, value]);
  });
}

