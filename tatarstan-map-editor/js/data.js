/**
 * Начальные данные для редактора карты Татарстана
 */

// Хранилище данных
const appData = {
  // Текущий выбранный датасет
  currentDataset: 'voices',
  
  // Датасеты
  datasets: {
    'voices': {
      name: 'Миллионы голосов',
      key: 'voices'
    },
    'heroes': {
      name: 'Наши герои',
      key: 'heroes'
    }
  },
  
  // Полигоны (районы)
  polygons: {
    voices: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [49.0, 55.4],
            [49.6, 55.4],
            [49.6, 55.7],
            [49.0, 55.7],
            [49.0, 55.4]
          ]]
        },
        properties: {
          name: 'Район 1 (voices)',
          fillColor: 'rgba(255, 165, 0, 0.3)',
          strokeColor: 'rgba(255, 100, 0, 1)'
        }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [49.7, 55.3],
            [50.2, 55.3],
            [50.2, 55.7],
            [49.7, 55.7],
            [49.7, 55.3]
          ]]
        },
        properties: {
          name: 'Район 2 (voices)',
          fillColor: 'rgba(100, 100, 255, 0.3)',
          strokeColor: 'rgba(0, 0, 200, 1)'
        }
      }
    ],
    heroes: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [51.0, 55.2],
            [51.5, 55.2],
            [51.5, 55.6],
            [51.0, 55.6],
            [51.0, 55.2]
          ]]
        },
        properties: {
          name: 'Район 3 (heroes)',
          fillColor: 'rgba(0, 200, 100, 0.3)',
          strokeColor: 'rgba(0, 150, 100, 1)'
        }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [50.0, 55.0],
            [50.5, 55.0],
            [50.5, 55.5],
            [50.0, 55.5],
            [50.0, 55.0]
          ]]
        },
        properties: {
          name: 'Район 4 (heroes)',
          fillColor: 'rgba(200, 0, 200, 0.3)',
          strokeColor: 'rgba(150, 0, 150, 1)'
        }
      }
    ]
  },
  
  // Данные пинов
  pins: {
    voices: {
      'Район 1 (voices)': [
        {
          name: 'Гульназ Шарипова',
          city: 'Зеленодольск',
          quote: 'Забота о людях — это главная ценность нашей работы.',
          photo: 'https://placehold.co/64x64/gray/white?text=Photo',
          video: 'https://vk.com/video_ext.php?xxxxxxx',
          coords: [49.3, 55.5]
        },
        {
          name: 'Человек 2',
          city: 'Набережные Челны',
          quote: 'Ещё одна цитата...',
          photo: 'https://framerusercontent.com/images/ka1hYjSqLAdbEd72D4ZEzJSkvk.jpeg',
          video: 'https://vk.com/video_ext.php?yyyyyyy',
          coords: [49.5, 55.6]
        }
      ],
      'Район 2 (voices)': [
        {
          name: 'Человек 3',
          city: 'Казань',
          quote: 'Третий участник',
          photo: 'https://placehold.co/64x64/gray/white?text=Photo',
          video: 'https://vk.com/video_ext.php?zzzzzzz',
          coords: [49.9, 55.5]
        }
      ]
    },
    heroes: {
      'Район 3 (heroes)': [
        {
          name: 'Герой 1',
          city: 'Казань',
          quote: 'Герой, совершающий подвиги.',
          photo: 'https://placehold.co/64x64/gray/white?text=Photo',
          video: 'https://vk.com/video_ext.php?aaaaaaa',
          coords: [51.3, 55.4]
        }
      ],
      'Район 4 (heroes)': [
        {
          name: 'Герой 2',
          city: 'Альметьевск',
          quote: 'Цитата про подвиги.',
          photo: 'https://placehold.co/64x64/gray/white?text=Photo',
          video: 'https://vk.com/video_ext.php?bbbbbbb',
          coords: [50.2, 55.3]
        },
        {
          name: 'Герой 3',
          city: 'Казань',
          quote: 'Ещё один герой',
          photo: 'https://placehold.co/64x64/gray/white?text=Photo',
          video: 'https://vk.com/video_ext.php?ccccccc',
          coords: [50.4, 55.4]
        }
      ]
    }
  },
  
  // Кэш для иконок
  iconCache: {}
};

// Функция для получения списка датасетов
function getDatasets() {
  return Object.values(appData.datasets);
}

// Функция для получения полигонов конкретного датасета
function getPolygons(datasetKey) {
  return appData.polygons[datasetKey] || [];
}

// Функция для получения пинов для указанного региона
function getPins(datasetKey, regionName) {
  const datasetPins = appData.pins[datasetKey];
  if (!datasetPins) return [];
  return datasetPins[regionName] || [];
}

// Функция для добавления нового датасета
function addDataset(key, name) {
  if (appData.datasets[key]) {
    throw new Error('Датасет с таким ключом уже существует');
  }
  
  appData.datasets[key] = {
    key: key,
    name: name
  };
  
  appData.polygons[key] = [];
  appData.pins[key] = {};
  
  return appData.datasets[key];
}

// Функция для удаления датасета
function deleteDataset(key) {
  if (!appData.datasets[key]) {
    throw new Error('Датасет не найден');
  }
  
  // Удаляем датасет и связанные данные
  delete appData.datasets[key];
  delete appData.polygons[key];
  delete appData.pins[key];
  
  // Если удаляем активный датасет, переключаемся на первый доступный
  if (appData.currentDataset === key) {
    const availableDatasets = Object.keys(appData.datasets);
    if (availableDatasets.length > 0) {
      appData.currentDataset = availableDatasets[0];
    } else {
      appData.currentDataset = null;
    }
  }
}

// Функция для добавления нового региона
function addRegion(datasetKey, regionData) {
  console.log('Добавление региона:', { datasetKey, regionData });
  
  if (!appData.datasets[datasetKey]) {
    throw new Error('Датасет не найден');
  }
  
  // Проверяем, что имя региона уникально в рамках датасета
  const existingRegions = appData.polygons[datasetKey] || [];
  const regionExists = existingRegions.some(region => region.properties.name === regionData.properties.name);
  
  if (regionExists) {
    throw new Error('Регион с таким именем уже существует');
  }
  
  // Инициализируем структуры данных, если они не существуют
  if (!appData.polygons) appData.polygons = {};
  if (!appData.pins) appData.pins = {};
  
  // Добавляем регион
  if (!appData.polygons[datasetKey]) {
    appData.polygons[datasetKey] = [];
  }
  appData.polygons[datasetKey].push(regionData);
  
  // Инициализируем массив для точек
  if (!appData.pins[datasetKey]) {
    appData.pins[datasetKey] = {};
  }
  appData.pins[datasetKey][regionData.properties.name] = [];
  
  // Сохраняем изменения
  saveData();
  
  console.log('Регион добавлен:', {
    polygons: appData.polygons[datasetKey],
    pins: appData.pins[datasetKey]
  });
  
  return regionData;
}

// Функция для обновления региона
function updateRegion(datasetKey, oldName, regionData) {
  if (!appData.datasets[datasetKey]) {
    throw new Error('Датасет не найден');
  }
  
  // Находим индекс региона
  const regions = appData.polygons[datasetKey] || [];
  const regionIndex = regions.findIndex(region => region.properties.name === oldName);
  
  if (regionIndex === -1) {
    throw new Error('Регион не найден');
  }
  
  // Если имя региона меняется, нужно обновить ссылки в пинах
  if (oldName !== regionData.properties.name) {
    // Проверяем, что новое имя уникально
    const nameExists = regions.some((region, index) => 
      index !== regionIndex && region.properties.name === regionData.properties.name);
    
    if (nameExists) {
      throw new Error('Регион с таким именем уже существует');
    }
    
    // Обновляем ссылки в пинах
    if (appData.pins[datasetKey][oldName]) {
      appData.pins[datasetKey][regionData.properties.name] = appData.pins[datasetKey][oldName];
      delete appData.pins[datasetKey][oldName];
    }
  }
  
  // Обновляем регион
  appData.polygons[datasetKey][regionIndex] = regionData;
  
  return regionData;
}

// Функция для удаления региона
function deleteRegion(datasetKey, regionName) {
  if (!appData.datasets[datasetKey]) {
    throw new Error('Датасет не найден');
  }
  
  // Находим индекс региона
  const regions = appData.polygons[datasetKey] || [];
  const regionIndex = regions.findIndex(region => region.properties.name === regionName);
  
  if (regionIndex === -1) {
    throw new Error('Регион не найден');
  }
  
  // Удаляем регион
  appData.polygons[datasetKey].splice(regionIndex, 1);
  
  // Удаляем пины для этого региона
  if (appData.pins[datasetKey][regionName]) {
    delete appData.pins[datasetKey][regionName];
  }
}

// Функция для добавления нового пина
function addPin(datasetKey, regionName, pinData) {
  if (!appData.datasets[datasetKey]) {
    throw new Error('Датасет не найден');
  }
  
  // Проверяем существование региона
  const regions = appData.polygons[datasetKey] || [];
  const regionExists = regions.some(region => region.properties.name === regionName);
  
  if (!regionExists) {
    throw new Error('Регион не найден');
  }
  
  // Инициализируем массив для пинов, если нужно
  if (!appData.pins[datasetKey]) {
    appData.pins[datasetKey] = {};
  }
  
  if (!appData.pins[datasetKey][regionName]) {
    appData.pins[datasetKey][regionName] = [];
  }
  
  // Добавляем пин
  appData.pins[datasetKey][regionName].push(pinData);
  
  return pinData;
}

// Функция для обновления пина
function updatePin(datasetKey, regionName, index, pinData) {
  console.log('Вызов updatePin с параметрами:', { datasetKey, regionName, index, pinData });
  
  if (!appData.datasets[datasetKey]) {
    console.error('Ошибка: Датасет не найден');
    throw new Error('Датасет не найден');
  }
  
  // Проверяем существование региона и пина
  if (!appData.pins[datasetKey]) {
    console.error('Ошибка: pins[datasetKey] не существует');
    throw new Error('Пин не найден');
  }
  
  if (!appData.pins[datasetKey][regionName]) {
    console.error('Ошибка: pins[datasetKey][regionName] не существует');
    throw new Error('Пин не найден');
  }
  
  if (!appData.pins[datasetKey][regionName][index]) {
    console.error('Ошибка: pins[datasetKey][regionName][index] не существует, длина массива:', appData.pins[datasetKey][regionName].length);
    throw new Error('Пин не найден');
  }
  
  // Обновляем пин
  appData.pins[datasetKey][regionName][index] = pinData;
  console.log('Пин успешно обновлен');
  
  return pinData;
}

// Функция для удаления пина
function deletePin(datasetKey, regionName, index) {
  if (!appData.datasets[datasetKey]) {
    throw new Error('Датасет не найден');
  }
  
  // Проверяем существование региона и пина
  if (!appData.pins[datasetKey] || 
      !appData.pins[datasetKey][regionName] || 
      !appData.pins[datasetKey][regionName][index]) {
    throw new Error('Пин не найден');
  }
  
  // Удаляем пин
  appData.pins[datasetKey][regionName].splice(index, 1);
} 