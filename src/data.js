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

    // функция получения записей - СИНХРОННАЯ для локальных данных
    const getRecords = (query, isUpdated = false) => {
        const qs = new URLSearchParams(query);
        const nextQuery = qs.toString();

        if (lastQuery === nextQuery && !isUpdated) {
            return Promise.resolve(lastResult);
        }

        const limit = parseInt(query.limit) || 10;
        const page = parseInt(query.page) || 1;
        const skip = (page - 1) * limit;

        // Всегда используем локальные данные для мгновенного результата
        lastQuery = nextQuery;
        lastResult = {
            total: localData.length,
            items: localData.slice(skip, skip + limit)
        };

        // Пытаемся загрузить с сервера в фоне (не блокируем)
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

        return Promise.resolve(lastResult);
    };

    return {
        getIndexes,
        getRecords
    }
}