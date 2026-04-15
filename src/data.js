import {makeIndex} from "./lib/utils.js";

const BASE_URL = 'https://webinars.webdev.education-services.ru/sp7-api';

export function initData(sourceData) {
    const sellers = makeIndex(sourceData.sellers, 'id', v => `${v.first_name} ${v.last_name}`);
    const customers = makeIndex(sourceData.customers, 'id', v => `${v.first_name} ${v.last_name}`);
    const localData = sourceData.purchase_records.map(item => ({
        id: item.receipt_id,
        date: item.date,
        seller: sellers[item.seller_id],
        customer: customers[item.customer_id],
        total: item.total_amount
    }));

    // переменные для кеширования данных
    let sellersCache = sellers; // сразу инициализируем локальными данными
    let customersCache = customers; // сразу инициализируем локальными данными
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
            // Если сервер доступен, используем его данные
            sellersCache = sellersRemote;
            customersCache = customersRemote;
        } catch (e) {
            // оставляем локальные данные
            console.log('Using local indexes');
        }

        return { sellers: sellersCache, customers: customersCache };
    }

    // функция получения записей о продажах с сервера
    const getRecords = async (query, isUpdated = false) => {
        const qs = new URLSearchParams(query);
        const nextQuery = qs.toString();

        if (lastQuery === nextQuery && !isUpdated) {
            return lastResult;
        }

        try {
            const response = await fetch(`${BASE_URL}/records?${nextQuery}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const records = await response.json();
            console.log('Server response:', records.total, 'records');

            lastQuery = nextQuery;
            lastResult = {
                total: records.total,
                items: mapRecords(records.items)
            };
        } catch (e) {
            console.warn('Using local data fallback:', e.message);
            // fallback на локальные данные с учётом пагинации
            const limit = parseInt(query.limit) || 10;
            const page = parseInt(query.page) || 1;
            const skip = (page - 1) * limit;

            console.log('Local data total:', localData.length, 'returning', limit, 'items from', skip);
            lastResult = {
                total: localData.length,
                items: localData.slice(skip, skip + limit)
            };
        }

        return lastResult;
    };

    return {
        getIndexes,
        getRecords
    }
}