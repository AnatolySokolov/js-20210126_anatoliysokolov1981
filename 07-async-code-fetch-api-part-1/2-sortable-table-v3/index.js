import fetchJson from './utils/fetch-json.js';

const BACKEND_URL = 'https://course-js.javascript.ru';

export default class SortableTable {
  element;
  subElements = {};
  data = [];
  step = 20;
  queryParams = {
    _sort: '',
    _order: 'asc',
    _start: 0,
    _end: 20
  };
  isSortLocally = false;
  isRequestSend = false;

  onHeaderPointerdown = async (event) => {
    const columnHeader = event.target.closest('.sortable-table__cell');
    const { id, order, sortable } = columnHeader.dataset;

    if (sortable === 'false') return;

    const orderToggle = {
      asc: 'desc',
      desc: 'asc'
    };

    columnHeader.dataset.order = orderToggle[order];
    columnHeader.append(this.subElements.arrow);

    this.queryParams._sort = id;
    this.queryParams._order = orderToggle[order];
    this.queryParams._start = 0;
    this.queryParams._end = 20;

    if (this.isSortLocally) {
      this.sort(this.queryParams._sort, this.queryParams._order);
    } else {
      this.sortOnServer(this.queryParams);
    }
  }

  onDocumentScroll = async () => {
    if (this.isRequestSend || this.isSortLocally) return;

    const { bottom } = document.documentElement.getBoundingClientRect();
    const htmlHeight = document.documentElement.clientHeight;
    const gap = 200;

    if (bottom < htmlHeight + gap) {
      this.isRequestSend = true;
      this.queryParams._start += this.step;
      this.queryParams._end += this.step;

      const data = await this.loadData(this.queryParams);

      this.update(data);
      this.isRequestSend = false;
    }
  }

  constructor(header = [], { url = '', step = 20, start = 0, isSortLocally = false } = {}) {
    this.header = header;
    this.url = new URL(url, BACKEND_URL);
    this.step = step;
    this.queryParams._start = start;
    this.queryParams._end = start + step;
    this.queryParams._sort = header.find(item => item.sortable).id;
    this.isSortLocally = isSortLocally;

    this.render();
    this.addListeners();
  }

  async loadData(queryParams = {}) {
    for (const key of Object.keys(queryParams)) {
      this.url.searchParams.set(key, queryParams[key]);
    }

    this.element.classList.add('sortable-table_loading');

    const data = await fetchJson(this.url);

    this.element.classList.remove('sortable-table_loading');

    return data;
  }

  getHeaderArrowTemplate(id) {
    const template = `
      <span data-element="arrow" class="sortable-table__sort-arrow">
        <span class="sort-arrow"></span>
      </span>
    `;

    return id === this.queryParams._sort ? template : '';
  }

  getHeaderRowTemplate( { id, title, sortable } ) {
    return `
      <div class="sortable-table__cell" data-id="${ id }" data-sortable="${ sortable }" ${ sortable ? 'data-order="asc"' : '' }>
        <span>${ title }</span>
        ${ this.getHeaderArrowTemplate(id) }
      </div>
    `;
  }

  createHeader() {
    return `
      <div data-element="header" class="sortable-table__header sortable-table__row">
        ${ this.header.map(item => this.getHeaderRowTemplate(item)).join('') }
      </div>
    `;
  }

  getBodyRowTemplate(data) {
    return data
      .map(item => {
        return `
          <a href="/products/${ item.id }" class="sortable-table__row">
            ${ this.getCellTemplate(item) }
          </a>
        `;
      })
      .join('');
  }

  getCellTemplate(item) {
    return this.header
      .map( ( { id, template } ) =>
        template ? template(item[id]) : `<div class="sortable-table__cell">${ item[id] }</div>`)
      .join('');
  }

  createBody() {
    return `
      <div data-element="body" class="sortable-table__body">
        ${ this.getBodyRowTemplate(this.data) }
      </div>
    `;
  }

  get template() {
    return `
      <div data-element="productsContainer" class="products-list__container">
        <div class="sortable-table">
          ${ this.createHeader() }
          ${ this.createBody() }
        </div>
      </div>
    `;
  }

  renderRows(data) {
    if (data.length) {
      this.subElements.body.innerHTML = this.getBodyRowTemplate(data);
      this.data = data;
      this.element.classList.remove('sortable-table_empty');
    } else {
      this.element.classList.add('sortable-table_empty');
    }
  }

  async render(){
    const element = document.createElement('div');

    element.innerHTML = this.template;
    this.element = element.firstElementChild;
    this.subElements = this.getSubElements(this.element);

    const data = await this.loadData(this.queryParams);

    this.renderRows(data);
  }

  getSubElements(element) {
    const elements = element.querySelectorAll('[data-element]');

    return [...elements].reduce( (acc, subElement) => {
      acc[subElement.dataset.element] = subElement;

      return acc;
    }, {});
  }

  makeSort(field, order) {
    const arr = [...this.data];
    const { sortType } = this.header.find(item => item.id === field);
    const direction = order === 'asc' ? 1 : -1;

    return arr.sort( (a, b) => {
      switch (sortType) {
        case 'string':
          return direction * a[field].localeCompare( b[field], ['ru', 'en'], { caseFirst: 'upper' } );
        case 'number':
          return direction * (a[field] - b[field]);
        case 'custom':
          return direction * customSorting(a, b);
        default:
          return direction * (a[field] - b[field]);
      }
    });
  }

  sort(field, order) {
    const sortedData = this.makeSort(field, order);

    this.subElements.body.innerHTML = this.getBodyRowTemplate(sortedData);
  }

  async sortOnServer(params) {
    const data = await this.loadData(params);

    this.renderRows(data);
  }

  addListeners() {
    this.subElements.header.addEventListener('click', this.onHeaderPointerdown);
    document.addEventListener('scroll', this.onDocumentScroll);
  }

  update(data) {
    this.subElements.body.insertAdjacentHTML('beforeend', this.getBodyRowTemplate(data));
    this.data = [...this.data, ...data];
  }

  remove() {
    this.element.remove();
  }

  destroy() {
    this.remove();
    this.subElements = {};
    document.removeEventListener('scroll', this.onDocumentScroll);
  }
}
