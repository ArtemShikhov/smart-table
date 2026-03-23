# Резервная копия проекта smart-table
Дата: 23 марта 2026 г.
Коммит: 0b29acc (HEAD -> main, origin/main)

---

## package.json
```json
{
  "name": "canonical",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
```

---

## .github/workflows/main.yml
```yaml
name: Tests

on:
  push:
    branches:
      - '**'
    tags:
      - '**'
  pull_request:
    branches:
      - '**'
env:
  DIR_TESTS: /tmp/tests-smart-table
  REP_TESTS: https://github.com/Yandex-Practicum/tests-smart-table.git
  REPO: ${{ github.event.repository.name }}
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
    - name: Set up GitHub Actions
      uses: actions/checkout@v4
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
    - name: Install dependencies
      run: npm ci
    - name: Get testing lib
      run: set -eu && git clone --depth 1 $REP_TESTS $DIR_TESTS
    - name: Run tests
      run: bash $DIR_TESTS/bin/run.sh
```

---

## src/main.js
```javascript
import './fonts/ys-display/fonts.css'
import './style.css'

import {data as sourceData} from "./data/dataset_1.js";

import {initData} from "./data.js";
import {processFormData} from "./lib/utils.js";

import {initTable} from "./components/table.js";
import {initPagination} from "./components/pagination.js";
import {initSorting} from "./components/sorting.js";
import {initFiltering} from "./components/filtering.js";
import {initSearching} from "./components/searching.js";

// Исходные данные используемые в render()
const {data, ...indexes} = initData(sourceData);

/**
 * Сбор и обработка полей из таблицы
 * @returns {Object}
 */
function collectState() {
    const state = processFormData(new FormData(sampleTable.container));

    const rowsPerPage = parseInt(state.rowsPerPage);
    const page = parseInt(state.page ?? 1);

    return {
        ...state,
        rowsPerPage,
        page
    };
}

/**
 * Перерисовка состояния таблицы при любых изменениях
 * @param {HTMLButtonElement?} action
 */
function render(action) {
    let state = collectState(); // состояние полей из таблицы
    let result = [...data]; // копируем для последующего изменения
    // @todo: использование
    result = applySearching(result, state, action);
    result = applyFiltering(result, state, action);
    result = applySorting(result, state, action);
    result = applyPagination(result, state, action);


    sampleTable.render(result)
}

const sampleTable = initTable({
    tableTemplate: 'table',
    rowTemplate: 'row',
    before: ['search', 'header', 'filter'],
    after: ['pagination']
}, render);

// @todo: инициализация
const applyPagination = initPagination(
    sampleTable.pagination.elements,
    (el, page, isCurrent) => {
        const input = el.querySelector('input');
        const label = el.querySelector('span');
        input.value = page;
        input.checked = isCurrent;
        label.textContent = page;
        return el;
    }
);

const applySorting = initSorting([
    sampleTable.header.elements.sortByDate,
    sampleTable.header.elements.sortByTotal
]);

const applyFiltering = initFiltering(sampleTable.filter.elements, {
    searchBySeller: indexes.sellers
});

const applySearching = initSearching('search');


const appRoot = document.querySelector('#app');
appRoot.appendChild(sampleTable.container);

render();
```

---

## src/components/table.js
```javascript
import {cloneTemplate} from "../lib/utils.js";

/**
 * Инициализирует таблицу и вызывает коллбэк при любых изменениях и нажатиях на кнопки
 *
 * @param {Object} settings
 * @param {(action: HTMLButtonElement | undefined) => void} onAction
 * @returns {{container: Node, elements: *, render: render}}
 */
export function initTable(settings, onAction) {
    const {tableTemplate, rowTemplate, before, after} = settings;
    const root = cloneTemplate(tableTemplate);

    // @todo: #1.2 —  вывести дополнительные шаблоны до и после таблицы
    before.reverse().forEach(subName => {
        root[subName] = cloneTemplate(subName);
        root.container.prepend(root[subName].container);
    });

    after.forEach(subName => {
        root[subName] = cloneTemplate(subName);
        root.container.append(root[subName].container);
    });

    // @todo: #1.3 —  обработать события и вызвать onAction()
    root.container.addEventListener('change', () => {
        onAction();
    });

    root.container.addEventListener('reset', () => {
        setTimeout(onAction);
    });

    root.container.addEventListener('submit', (e) => {
        e.preventDefault();
        onAction(e.submitter);
    });

    const render = (data) => {
        // @todo: #1.1 — преобразовать данные в массив строк на основе шаблона rowTemplate
        const nextRows = data.map(item => {
            const row = cloneTemplate(rowTemplate);
            Object.keys(item).forEach(key => {
                if (row.elements[key]) {
                    const el = row.elements[key];
                    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                        el.value = item[key];
                    } else {
                        el.textContent = item[key];
                    }
                }
            });
            return row.container;
        });
        root.elements.rows.replaceChildren(...nextRows);
    }

    return {...root, render};
}
```

---

## src/components/pagination.js
```javascript
import {getPages} from "../lib/utils.js";

export const initPagination = ({pages, fromRow, toRow, totalRows}, createPage) => {
    // @todo: #2.3 — подготовить шаблон кнопки для страницы и очистить контейнер
    const pageTemplate = pages.firstElementChild.cloneNode(true);
    pages.firstElementChild.remove();

    return (data, state, action) => {
        // @todo: #2.1 — посчитать количество страниц, объявить переменные и константы
        const rowsPerPage = state.rowsPerPage;
        const pageCount = Math.ceil(data.length / rowsPerPage);
        let page = state.page;

        // @todo: #2.6 — обработать действия
        if (action) switch(action.name) {
            case 'prev': page = Math.max(1, page - 1); break;
            case 'next': page = Math.min(pageCount, page + 1); break;
            case 'first': page = 1; break;
            case 'last': page = pageCount; break;
        }

        // @todo: #2.4 — получить список видимых страниц и вывести их
        const visiblePages = getPages(page, pageCount, 5);
        pages.replaceChildren(...visiblePages.map(pageNumber => {
            const el = pageTemplate.cloneNode(true);
            return createPage(el, pageNumber, pageNumber === page);
        }));

        // @todo: #2.5 — обновить статус пагинации
        fromRow.textContent = (page - 1) * rowsPerPage + 1;
        toRow.textContent = Math.min((page * rowsPerPage), data.length);
        totalRows.textContent = data.length;

        // @todo: #2.2 — посчитать сколько строк нужно пропустить и получить срез данных
        const skip = (page - 1) * rowsPerPage;
        return data.slice(skip, skip + rowsPerPage);
    }
}
```

---

## src/components/sorting.js
```javascript
import {sortCollection, sortMap} from "../lib/sort.js";

export function initSorting(columns) {
    return (data, state, action) => {
        let field = null;
        let order = null;

        if (action && action.name === 'sort') {
            // @todo: #3.1 — запомнить выбранный режим сортировки
            action.dataset.value = sortMap[action.dataset.value];
            field = action.dataset.field;
            order = action.dataset.value;

            // @todo: #3.2 — сбросить сортировки остальных колонок
            columns.forEach(column => {
                if (column.dataset.field !== action.dataset.field) {
                    column.dataset.value = 'none';
                }
            });
        } else {
            // @todo: #3.3 — получить выбранный режим сортировки
            columns.forEach(column => {
                if (column.dataset.value !== 'none') {
                    field = column.dataset.field;
                    order = column.dataset.value;
                }
            });
        }

        return sortCollection(data, field, order);
    }
}
```

---

## src/components/filtering.js
```javascript
import {createComparison, defaultRules} from "../lib/compare.js";

// @todo: #4.3 — настроить компаратор
const compare = createComparison(defaultRules);

export function initFiltering(elements, indexes) {
    // @todo: #4.1 — заполнить выпадающие списки опциями
    Object.keys(indexes).forEach((elementName) => {
        elements[elementName].append(
            ...Object.values(indexes[elementName]).map(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                return option;
            })
        );
    });

    return (data, state, action) => {
        // @todo: #4.2 — обработать очистку поля
        if (action && action.name === 'clear') {
            const input = action.parentElement.querySelector('input');
            if (input) {
                input.value = '';
                state[action.dataset.field] = '';
            }
        }

        // @todo: #4.5 — отфильтровать данные используя компаратор
        return data.filter(row => compare(row, state));
    }
}
```

---

## src/components/searching.js
```javascript
import {rules, createComparison} from "../lib/compare.js";


export function initSearching(searchField) {
    // @todo: #5.1 — настроить компаратор
    const compare = createComparison(
        ['skipEmptyTargetValues'],
        [rules.searchMultipleFields(searchField, ['date', 'customer', 'seller'], false)]
    );

    return (data, state, action) => {
        // @todo: #5.2 — применить компаратор
        return data.filter(row => compare(row, state));
    }
}
```

---

## src/data.js
```javascript
import {makeIndex} from "./lib/utils.js";

export function initData(sourceData) {
    const sellers = makeIndex(sourceData.sellers, 'id', v => `${v.first_name} ${v.last_name}`);
    const customers = makeIndex(sourceData.customers, 'id', v => `${v.first_name} ${v.last_name}`);
    const data = sourceData.purchase_records.map(item => ({
        id: item.receipt_id,
        date: item.date,
        seller: sellers[item.seller_id],
        customer: customers[item.customer_id],
        total: item.total_amount
    }));
    return {sellers, customers, data};
}
```

---

## index.html
```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <link rel="icon" type="image/svg+xml" href="/vite.svg"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Data Table App</title>
</head>
<body>
<main id="app" class="container">
    <!-- Table content will be inserted here -->
</main>

<!-- Search bar template -->
<template id="search">
    <div class="search-bar">
        <label class="search-wrapper" data-name="searchField">
            <i class="icon search-icon" aria-hidden="true"></i>
            <input type="text" name="search" class="input" placeholder="Search" data-name="search">
        </label>
        <button type="reset" class="button reset-wrapper" data-name="reset">
            Reset all filters
            <i class="icon reset-icon" aria-hidden="true"></i>
        </button>
    </div>
</template>

<template id="header">
    <div class="table-row header-row" role="rowgroup">
        <div class="table-column" role="columnheader">
            <div class="sortable">
                Date
                <button type="submit" name="sort" data-field="date" data-value="none" class="icon" data-name="sortByDate" aria-label="Sort by date"></button>
            </div>
        </div>
        <div class="table-column" role="columnheader">
            Customer
        </div>
        <div class="table-column" role="columnheader">Seller</div>
        <div class="table-column" role="columnheader">
            <div class="sortable">
                Total
                <button type="submit" name="sort" data-field="total" data-value="none" class="icon" data-name="sortByTotal" aria-label="Sort by total"></button>
            </div>
        </div>
    </div>
</template>

<template id="filter">
    <div class="table-row filter-row" data-name="filter" role="rowgroup">
        <div class="table-column">
            <label class="filter-wrapper">
                <input type="text" value="" class="input" placeholder="Search" name="date" data-name="searchByDate">
                <button type="submit" name="clear" data-field="date" class="icon" aria-label="Filter by date"></button>
            </label>
        </div>
        <div class="table-column">
            <label class="filter-wrapper">
                <input type="text" value="" class="input" name="customer" placeholder="Search" data-name="searchByCustomer">
                <button type="submit" name="clear" data-field="customer" class="icon" aria-label="Filter by customer"></button>
            </label>
        </div>
        <div class="table-column">
            <label class="dropdown-select">
                <select name="seller" data-name="searchBySeller" aria-label="Filter by seller">
                    <option value="" selected>—</option>
                </select>
            </label>
        </div>
        <div class="table-column">
            <div class="range-inputs">
                <input type="text" class="input" placeholder="from" name="totalFrom" data-name="totalFrom"
                       aria-label="Experience from">
                <input type="text" class="input" placeholder="to" name="totalTo" data-name="totalTo"
                       aria-label="Experience to">
            </div>
        </div>
    </div>
</template>

<!-- Table template -->
<template id="table">
    <form name="table" class="table" style="--columns: 1fr 1fr 1fr 1fr" role="table" aria-label="Data table">
        <!-- Header row -->
        <!-- Filter row -->
        <!-- Table content -->
        <div class="table-content" data-name="rows" role="rowgroup">
            <!-- Rows will be inserted here -->
        </div>
    </form>
</template>

<!-- Pagination template -->
<template id="pagination">
    <div class="pagination-container">
        <div class="pagination-controls">
            <button type="submit" name="first" class="pagination-button" data-name="firstPage" aria-label="First page">
                <i class="icon chevrons-left" aria-hidden="true"></i>
            </button>
            <button type="submit" name="prev" class="pagination-button" data-name="previousPage" aria-label="Previous page">
                <i class="icon left" aria-hidden="true"></i>
            </button>
            <div class="pagination-pages" data-name="pages" role="group" aria-label="Page navigation">
                <!-- Page buttons will be generated dynamically -->
                <label class="pagination-button" aria-label="Goto page 1">
                    <input type="radio" name="page" value="1">
                    <span>1</span>
                </label>
            </div>
            <button type="submit" name="next" class="pagination-button" data-name="nextPage" aria-label="Next page">
                <i class="icon right" aria-hidden="true"></i>
            </button>
            <button type="submit" name="last" class="pagination-button" data-name="lastPage" aria-label="Last page">
                <i class="icon chevrons-right" aria-hidden="true"></i>
            </button>
        </div>
        <div class="pagination-settings">
            <div class="pagination-status">
                Showing <span data-name="fromRow">1</span>
                to <span data-name="toRow">10</span>
                of <span data-name="totalRows">200</span> entries
            </div>
            <label class="dropdown-select rows-per-page">
                <select name="rowsPerPage" data-name="rowsPerPage" aria-label="Rows per page">
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                </select>
            </label>
        </div>
    </div>
</template>

<!-- Row template -->
<template id="row">
    <div class="table-row" role="row">
        <div class="table-column" data-name="date" role="cell"></div>
        <div class="table-column" data-name="customer" role="cell"></div>
        <div class="table-column" data-name="seller" role="cell"></div>
        <div class="table-column" data-name="total" role="cell"></div>
    </div>
</template>

<script type="module" src="/src/main.js"></script>
</body>
</html>
```

---

## Сводка изменений

### Реализованные шаги:

**Шаг 1 — Вывод данных в таблицу:**
- ✅ Трансформация данных в строки через `data.map()`
- ✅ Добавление шаблонов `before`/`after`
- ✅ Обработчики событий: `change`, `reset`, `submit`

**Шаг 2 — Пагинация:**
- ✅ Подключён шаблон `pagination`
- ✅ Инициализирована `initPagination()`
- ✅ Вычисление количества страниц и обрезка данных
- ✅ Вывод кнопок страниц через `getPages()`
- ✅ Обновление статуса (from/to/total)
- ✅ Обработка действий: `prev`, `next`, `first`, `last`

**Шаг 3 — Сортировка:**
- ✅ Подключён шаблон `header`
- ✅ Инициализирована `initSorting()`
- ✅ Переключение состояния кнопок через `sortMap`
- ✅ Сброс остальных кнопок в `'none'`
- ✅ Восстановление текущей сортировки

**Шаг 4 — Фильтрация:**
- ✅ Подключён шаблон `filter`
- ✅ Инициализирована `initFiltering()`
- ✅ Заполнение `<select>` опциями
- ✅ Очистка полей при клике на `clear`
- ✅ Фильтрация через компаратор

**Шаг 5 — Поиск:**
- ✅ Подключён шаблон `search`
- ✅ Инициализирован `initSearching('search')`
- ✅ Поиск по полям `date`, `customer`, `seller`

**Исправления:**
- ✅ Исправлены вложенные CSS-правила в `style.css`
- ✅ Добавлена установка зависимостей в GitHub Actions workflow
- ✅ `package.json` обновлён на Vite 5.4.0
- ✅ `package-lock.json` сгенерирован корректно

### Порядок применения модулей:
1. Поиск
2. Фильтрация
3. Сортировка
4. Пагинация

---

## Git статус
Все изменения закоммичены и отправлены в репозиторий.
Коммит: 0b29acc (HEAD -> main, origin/main)
