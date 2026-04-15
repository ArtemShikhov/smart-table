import {makeIndex} from "./lib/utils.js";
import {data as sourceData} from "./data/dataset_1.js";
import {sortCollection} from "./lib/sort.js";
import {createComparison, defaultRules} from "./lib/compare.js";

const BASE_URL = 'https://webinars.webdev.education-services.ru/sp7-api';

export function initData(externalSourceData) {
    const dataToUse = externalSourceData || sourceData;
    const sellers = makeIndex(dataToUse.sellers, 'id', v => `${v.first_name} ${v.last_name}`);
    const customers = makeIndex(dataToUse.customers, 'id', v => `${v.first_name} ${v.last_name}`);
    const localData = dataToUse.purchase_records.map(item => ({
        id: item.receipt_id,
        date: item.date,
        seller: sellers[item.seller_id],
        customer: customers[item.customer_id],
        total: item.total_amount
    }));

    // переменные для кеширования данных - сразу инициализированы
    let sellersCache = sellers;
    let customersCache = customers;
    let lastResult;
    let lastQuery;

    // функция для приведения строк в тот вид, который нужен нашей таблице
    const mapRecords = (data) => data.map(item => ({
        id: item.receipt_id,
        date: item.date,
        seller: sellersCache[item.seller_id],
        customer: customersCache[item.customer_id],
        total: item.total_amount
    }));

    // функция получения индексов
    const getIndexes = async () => {
        try {
            const [sellersRemote, customersRemote] = await Promise.all([
                fetch(`${BASE_URL}/sellers`).then(res => res.json()),
                fetch(`${BASE_URL}/customers`).then(res => res.json()),
            ]);
            sellersCache = sellersRemote;
            customersCache = customersRemote;
        } catch (e) {
            console.log('Using local indexes');
        }

        return { sellers: sellersCache, customers: customersCache };
    }

    // синхронная версия с сортировкой и фильтрацией
    const getRecordsSync = (query, isUpdated = false) => {
        const qs = new URLSearchParams(query);
        const nextQuery = qs.toString();

        if (lastQuery === nextQuery && !isUpdated) {
            return lastResult;
        }

        const limit = parseInt(query.limit) || 10;
        const page = parseInt(query.page) || 1;
        const skip = (page - 1) * limit;

        // Применяем фильтрацию если указана
        let filteredData = [...localData];
        const filterKeys = Object.keys(query).filter(k => k.startsWith('filter['));
        
        // Извлекаем totalFrom и totalTo из фильтров
        let totalFromValue = null;
        let totalToValue = null;
        const filter = {};
        
        filterKeys.forEach(key => {
            const fieldName = key.replace('filter[', '').replace(']', '');
            if (fieldName === 'totalFrom') {
                totalFromValue = query[key];
            } else if (fieldName === 'totalTo') {
                totalToValue = query[key];
            } else {
                filter[fieldName] = query[key];
            }
        });
        
        const hasSearch = query.search !== undefined && query.search !== '';
        const hasTotalFrom = totalFromValue !== null && totalFromValue !== '';
        const hasTotalTo = totalToValue !== null && totalToValue !== '';
        
        if (filterKeys.length > 0 || hasSearch || hasTotalFrom || hasTotalTo) {
            const comparator = createComparison(defaultRules);
            filteredData = localData.filter(item => {
                // Проверяем поиск
                if (hasSearch) {
                    const searchTerm = query.search.toLowerCase();
                    const matchesSearch = 
                        item.date.toLowerCase().includes(searchTerm) ||
                        item.seller.toLowerCase().includes(searchTerm) ||
                        item.customer.toLowerCase().includes(searchTerm) ||
                        String(item.total).includes(searchTerm);
                    if (!matchesSearch) {
                        return false;
                    }
                }
                
                // Проверяем обычные фильтры
                if (Object.keys(filter).length > 0 && !comparator(item, filter)) {
                    return false;
                }
                
                // Проверяем диапазон total
                if (hasTotalFrom) {
                    const from = parseFloat(totalFromValue);
                    if (!isNaN(from)) {
                        const itemTotal = typeof item.total === 'string' ? parseFloat(item.total) : item.total;
                        if (itemTotal < from) {
                            return false;
                        }
                    }
                }
                if (hasTotalTo) {
                    const to = parseFloat(totalToValue);
                    if (!isNaN(to)) {
                        const itemTotal = typeof item.total === 'string' ? parseFloat(item.total) : item.total;
                        if (itemTotal > to) {
                            return false;
                        }
                    }
                }
                
                return true;
            });
        }

        // Применяем сортировку если указана
        let sortedData = [...filteredData];
        if (query.sort) {
            const [field, order] = query.sort.split(':');
            sortedData = sortCollection(filteredData, field, order);
        }

        // Всегда используем локальные данные для мгновенного результата
        lastQuery = nextQuery;
        lastResult = {
            total: sortedData.length,
            items: sortedData.slice(skip, skip + limit)
        };

        // Пытаемся загрузить с сервера в фоне (не блокируем)
        try {
            fetch(`${BASE_URL}/records?${nextQuery}`)
                .then(res => res.ok ? res.json() : null)
                .then(records => {
                    if (records) {
                        lastResult = {
                            total: records.total,
                            items: mapRecords(records.items)
                        };
                    }
                })
                .catch(() => {});
        } catch (e) {
            // fetch может не работать в некоторых окружениях
        }

        return lastResult;
    };

    // функция получения записей - СИНХРОННАЯ для локальных данных
    const getRecords = (query, isUpdated = false) => {
        return Promise.resolve(getRecordsSync(query, isUpdated));
    };

    return {
        getIndexes,
        getRecords,
        getRecordsSync
    }
}