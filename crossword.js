(function (window, document) {
    'use strict';

    function CrossWord (options) {
        var defaultOptions = {
            blankChar: '#',
            highlightChar: '@',
            data: null,
            format: 'txt', // txt,csv,xml
            xmlElement: 'Crossword',
            container: null,
            minWordChar: 2,
            responsive: true,
            tableElement: 'table',
            rowElement: 'tr',
            cellElement: 'td',
            clues: {
                container: null,
                labels: {
                    horizontal: 'Across',
                    vertical: 'Down'
                },
                horizontal: [],
                vertical: []
            }
        };

        this.crosswordEl = null;
        this.cluesEl = null;
        this.wordNumbers = {horizontal: [], vertical: []};
        this.highlightedTiles = [];
        this.specialTiles = [];
        this.highlightState = '';
        this.highlightedClue;
        this._unique_prefix = CrossWord.CLASS_PREFIX + (+new Date() - parseInt(Math.random() * 1000)) + '-';
        this._elementOnFocus;
        this._cluesInitialized = false;
        this._fromTable = false;
        this._fromTablePlace = false;
        this._crosswordOnClick;
        this._crosswordOnKeydown;
        this._clueOnClick;
        this._onWindowResize;

        this.options = merge2Objects(defaultOptions, options);
    }

    function  merge2Objects (obj1, obj2) {
        var temp = {};

        if (Object.prototype.toString.call(obj1) !== '[object Object]') {
            return temp;
        }

        obj2 = obj2 || {};

        Object.keys(obj1).map(function (k) {
            if (!obj2.hasOwnProperty(k)) {
                temp[k] = Object.prototype.toString.call(obj1[k]) === '[object Object]' ? merge2Objects(obj1[k], obj2[k]) : obj1[k];
            } else {
                temp[k] = Object.prototype.toString.call(obj1[k]) === '[object Object]' ? merge2Objects(obj1[k], obj2[k]) : obj2[k];
            }
        });

        return temp;
    }

    function b64EncodeUnicode (str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
            }));
    }

    function b64DecodeUnicode(str) {
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }

    function getLongestRow (data, excludeChar) {
        var rows = data.split("\n"),
            longestRowLen = 0;
        excludeChar = excludeChar || null;

        for (var i = 0; i < rows.length; i++) {
            if (rows[i].length > longestRowLen) {
                var matches = rows[i].match(new RegExp(excludeChar, 'g'));
                longestRowLen = rows[i].length - (excludeChar && matches && matches.length);
            }
        }
        return longestRowLen;
    }

    function drawSquare(context, startx, starty, width, height, fillColor, strokeColor) {
        width = width || 30;
        height = height || 30;
        fillColor = fillColor || 'white';
        strokeColor = strokeColor || 'black';

        context.beginPath();
        context.rect(startx, starty, width, height);
        context.fillStyle = fillColor;
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = strokeColor;
        context.stroke();
    }

    CrossWord.HIGHLIGHT_DEFAULT     = '';
    CrossWord.HIGHLIGHT_HORIZONTAL  = '-';
    CrossWord.HIGHLIGHT_VERTICAL    = '|';
    CrossWord.CLASS_PREFIX          = 'yncw-';

    CrossWord.prototype = {
        init: function () {
            var self = this;

            if (!this.options.data) {
                throw Error('Please set the "data" property in the options!');
            }

            if (typeof this.options.data === 'function') {
                this.options.data = this.options.data();
            }

            if (this.options.data instanceof HTMLTableElement) {
                this.options.data = this._buildFromTable(this.options.data);
            }

            if (this.options.format === 'xml') {
                this.options.data = this._buildFromXML(this.options.data);
            }

            if (this.options.data.split("\n").length < 3) {
                throw Error('The provided data is not in the correct format!');
            }

            this.options.container = typeof this.options.container === 'string' ?
                document.querySelector(this.options.container) : (this.options.container instanceof HTMLElement ? this.options.container : null);

            if (!this.options.container) {
                throw Error('The "container" property in the options should be string or HTMLElement, ' + typeof this.options.container + ' given!');
            }

            this.options.data = this._balanceRows(this.options.data);
            this.specialTiles = this._getSpecialTiles();

            if (this.specialTiles.length > 0) {
                this.options.data = this._balanceRows(this.options.data);
            }

            this.rowsText = this.options.data.split("\n");
            this.colsText = this._getColsText(this.rowsText);
            this.wordsHorizontal = this._getWords(this.rowsText);
            this.wordsVertical = this._getWords(this.colsText, true);
            this._lettersMap = this._mapLetters(this.rowsText);
            this.crosswordEl = this._create(this.rowsText);

            this._addNumbers();
            this._initCrosswordEvents();

            this.options.responsive && setTimeout(function () {
                self._responsive();
            }, 300);
        },

        _getColsText: function (rows) {
            var rowLetters = [],
                colWords = [],
                colslen = rows.length,
                rowslen = rows[0].length;

            for (var i = 0; i < rows.length; i++) {
                rowLetters[i] = rows[i].split('');
            }

            for (var j = 0; j < rowslen; j++) {
                colWords[j] = [];
                for (var g = 0; g < colslen; g++) {
                    colWords[j] += rowLetters[g] && rowLetters[g][j] || '';
                }
            }

            return colWords;
        },

        _getWords: function (rows, vertical) {
            var wordList = [];
            vertical = vertical || false;

            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var words = row.split(this.options.blankChar);

                for (var j = 0; j < words.length; j++) {
                    if (words[j] && words[j].length > this.options.minWordChar - 1) {
                        var wordStart = row.indexOf(words[j]);
                        var start = [i, wordStart];
                        var end = [i, wordStart + words[j].length - 1];

                        // TODO: when there're two words with same characters this cause error
                        row = row.replace(words[j], (new Array(words[j].length + 1)).join('_'));

                        if (vertical) {
                            start.reverse();
                            end.reverse();
                        }

                        wordList.push({
                            row: !vertical ? i : wordStart,
                            col: vertical ? i : wordStart,
                            coords: [start, end].slice(0),
                            isVertical: vertical,
                            word: words[j]
                        });
                    }
                }
            }
            return wordList;
        },

        _mapLetters: function (rows) {
            var map = {},
                rowsLen = rows.length;

            for (var i = 0; i < rowsLen; i++) {
                var chars = rows[i].split('');
                var charsLen = chars.length;
                var nextRowChars = (rows[i+1] || '').split('');
                var prevRowChars = (rows[i-1] || '').split('');

                for (var j = 0; j < chars.length; j++) {
                    map[i+'x'+j] = {
                        char: chars[j],
                        row: i,
                        col: j,
                        cell: null,
                        special: this.specialTiles.indexOf(i + ',' + j) !== -1,
                        blank: chars[j] === this.options.blankChar,
                        hasLeft: j > 0 && chars[j - 1].replace(this.options.blankChar, '').length > 0,
                        hasRight: j < (charsLen - 1) && chars[j+1].replace(this.options.blankChar,'').length > 0,
                        hasUp: i > 0 && prevRowChars[j].replace(this.options.blankChar,'').length > 0,
                        hasDown: i < (rowsLen - 1) && nextRowChars[j].replace(this.options.blankChar,'').length > 0
                    };
                }
            }

            return map;
        },

        _balanceRows: function (data) {
            var self = this,
                longestRow = 0,
                rows,
                d = data;

            // if is CSV format, normalize it
            if (this.options.format.toLowerCase() === 'csv') {
                d = data.split("\n").map(function (r) {
                    return r.split(',').map(function (x) {
                        return x.length === 0 ? self.options.blankChar : x;
                    })
                    .join('');
                })
                .join("\n");
            }

            // split to array
            rows = d.split("\n");

            // get longest row
            longestRow = getLongestRow(d, this.options.highlightChar) || 0;

            for (var i = 0; i < rows.length; i++) {
                for (var j = 0; j < longestRow; j++) {
                    if (typeof rows[i][j] === 'undefined') {
                        rows[i] += this.options.blankChar;
                    }
                }
            }

            return rows.join("\n");
        },

        _buildFromTable: function (table) {
            var rows, cols, data = [];

            if (! table instanceof HTMLTableElement) {
                throw Error('Not HTMLTable element!');
            }

            rows = table.rows;

            for (var i = 0; i < rows.length; i++) {
                cols = rows[i].cells;
                data[i] = '';

                for (var j = 0; j < cols.length; j++) {
                    data[i] += cols[j].textContent.length === 0 ? this.options.blankChar : cols[j].textContent;
                }
            }

            table.insertAdjacentHTML('afterend', '<!-- ' + CrossWord.CLASS_PREFIX + 'crossword-table -->');
            this._fromTable = table;
            this._fromTablePlace = table.nextSibling;

            table.parentElement.removeChild(table);

            return data.join("\n");
        },

        _buildFromXML: function (xmlTxt) {
            var parser, xmlDOM, crossWord, rows, cols, data = [];

            if (window.DOMParser) {
                parser = new DOMParser();
                xmlDOM = parser.parseFromString(xmlTxt, "text/xml");
            }
            else { // Internet Explorer
                xmlDOM = new ActiveXObject("Microsoft.XMLDOM");
                xmlDOM.async = false;
                xmlDOM.loadXML(xmlTxt);
            }

            crossWord = xmlDOM.getElementsByTagName(this.options.xmlElement);

            if (!crossWord.length) {
                return '';
            }

            rows = crossWord[0].children;
            for (var i = 0; i < rows.length; i++) {
                cols = rows[i].textContent.split('');
                data[i] = '';

                for (var j = 0; j < cols.length; j++) {
                    data[i] += cols[j];
                }
            }

            return data.join("\n");
        },

        _create: function (rows) {
            var frag = document.createDocumentFragment();
            var table = document.createElement(this.options.tableElement);
            var row = document.createElement(this.options.rowElement);
            var cell = document.createElement(this.options.cellElement);
            var input = document.createElement('input');

            input.setAttribute('maxlength', 1);
            input.setAttribute('tabindex', -1);

            table.classList.add(CrossWord.CLASS_PREFIX + 'crossword');
            frag.appendChild(table);

            for (var i = 0; i < rows.length; i++) {
                var chars = rows[i].split('');
                var r = row.cloneNode(false);

                r.classList.add(CrossWord.CLASS_PREFIX + 'row');
                table.appendChild(r);

                for (var j = 0; j < chars.length; j++) {
                    var c = cell.cloneNode(false);

                    c.setAttribute('data-coords', i + ',' + j);
                    c.setAttribute('id', this._unique_prefix + i + '-' + j);
                    c.classList.add(CrossWord.CLASS_PREFIX + (chars[j] !== this.options.blankChar ? 'letter':'blank'));
                    this.specialTiles.indexOf(i + ',' + j) !== -1 && c.classList.add('special-tile');

                    c.classList.contains(CrossWord.CLASS_PREFIX + 'letter') && c.appendChild(input.cloneNode(false));
                    r.appendChild(c);
                    this._lettersMap[i + 'x' + j].cell = c;
                }
            }

            this.options.container.appendChild(frag);

            return table;
        },

        getHorizontalWord: function (currentMarkerCoords) {
            var coords = currentMarkerCoords;
            var row = coords[0];
            var col = coords[1];

            if (this._lettersMap[coords[0]+'x'+col].hasLeft) {
                --col;
                return this.getHorizontalWord([row, col]);
            }

            while (this._lettersMap[coords[0]+'x'+col] && this._lettersMap[coords[0]+'x'+col].blank === false) {
                col++;
            }

            //return [coords[1], col-1];
            return [[row, coords[1]], [row, col-1]];
        },

        getVerticalWord: function (currentMarkerCoords) {
            var coords = currentMarkerCoords;
            var row = coords[0];
            var col = coords[1];

            if (this._lettersMap[row+'x'+coords[1]].hasUp) {
                --row;
                return this.getVerticalWord([row, col]);
            }

            while (this._lettersMap[row+'x'+coords[1]] && this._lettersMap[row+'x'+coords[1]].blank === false) {
                ++row;
            }

            //return [coords[0], row-1];
            return [[coords[0], col], [row-1, col]];
        },

        getSpecialWord: function () {
            var self = this;
            return this.specialTiles.map(function (coords) {
                return self._lettersMap(coords.replace(',', 'x')).cell.firstElementChild.value;
            })
                .join('');
        },

        _getSpecialTiles: function () {
            var self = this,
                rows,
                currRowSpecTiles = 0,
                specialTiles = [];

            if (this.specialTiles.length > 0) {
                return this.specialTiles;
            }

            // split to array
            rows = this.options.data.split("\n");

            for (var i = 0; i < rows.length; i++) {
                currRowSpecTiles = 0;
                for (var j = 0; j < rows[i].length; j++) {
                    if (rows[i][j] === self.options.highlightChar) {
                        specialTiles.push(i + ',' + (j - currRowSpecTiles));
                        currRowSpecTiles++;
                    }
                }
            }

            this.options.data = this.options.data.split("\n").map(function(row) {
                return row.replace(new RegExp(self.options.highlightChar, 'g'), '');
            })
                .join("\n");

            return specialTiles;
        },

        _addNumbers: function() {
            var self = this,
                boxClasses = [],
                span = document.createElement('span'),
                counter = 0,
                wordList = this.wordsHorizontal.concat(this.wordsVertical);

            for (var i = 0; i < wordList.length; i++) {
                boxClasses.push(wordList[i].coords[0].join('x'));
            }

            // Sort the words by row
            boxClasses = boxClasses.sort(function(a, b) {
                var aa = a.split('x').map(Number),
                    bb = b.split('x').map(Number);

                return aa[0] > bb[0] ? 1 : (bb[0] > aa[0] ? -1 : (aa[1] > bb[1] ? 1 : (bb[1] > aa[1] ? -1 : 0)));
            })
                .filter(function (value, index, self) {
                    return self.indexOf(value) === index;
                });

            boxClasses.map(function (id) {
                var s = span.cloneNode(false),
                    word = self._isWordStart(id.split('x'));

                s.textContent = (++counter) + '';
                self._lettersMap[id].cell.appendChild(s);

                word.horizontal && self.wordNumbers.horizontal.push({coords: word.horizontal.coords[0], number: counter});
                word.vertical && self.wordNumbers.vertical.push({coords: word.vertical.coords[0], number: counter});
            });
        },

        highlight: function (coords) {
            var self = this,
                selectedTiles = [];

            if (!Array.isArray(coords) || coords.length !== 2) {
                return;
            }

            for (var i = coords[0][0]; i < coords[1][0]+1; i++) {
                for (var j = coords[0][1]; j < coords[1][1]+1; j++) {
                    selectedTiles.push(i + 'x' + j);
                }
            }

            this.clearHighlight();
            this.highlightedTiles = selectedTiles.map(function (id) {
                var el = self._lettersMap[id].cell;
                el.classList.add('highlight');
                return el;
            });

            return this.highlightedTiles;
        },

        clearHighlight: function () {
            for (var i = 0; i < this.highlightedTiles.length; i++) {
                this.highlightedTiles[i].classList.remove('highlight');
            }
        },

        _isHorizontalWordFilled: function (coords) {
            var wordCoords = this.getHorizontalWord(coords);

            for (var i = wordCoords[0][0]; i < wordCoords[1][0]+1; i++) {
                for (var j = wordCoords[0][1]; j < wordCoords[1][1]+1; j++) {
                    if (this._lettersMap(i + 'x' + j).cell.firstElementChild.value.length === 0) {
                        return false;
                    }
                }
            }

            return true;
        },

        _isVerticalWordFilled: function (coords) {
            var wordCoords = this.getVerticalWord(coords);

            for (var i = wordCoords[0][0]; i < wordCoords[1][0]+1; i++) {
                for (var j = wordCoords[0][1]; j < wordCoords[1][1]+1; j++) {
                    if (this._lettersMap(i + 'x' + j).firstElementChild.value.length === 0) {
                        return false;
                    }
                }
            }

            return true;
        },

        _getNextEmptyTile: function (coords) {
            var el = this._lettersMap[coords.join('x')].cell;
                coords = coords.slice();

            while (el.firstElementChild && el.firstElementChild.value.length > 0) {
                this.highlightState === CrossWord.HIGHLIGHT_VERTICAL ? coords[0]++ : coords[1]++;
                el = this._lettersMap[coords.join('x')].cell;
            }
            return el;
        },

        _isWordStart: function (coords) {
            return {
                horizontal: this.wordsHorizontal.filter(function (w) {
                    return parseInt(w.row) === parseInt(coords[0]) && parseInt(w.col) === parseInt(coords[1]);
                })[0] || null,
                vertical: this.wordsVertical.filter(function (w) {
                    return parseInt(w.row) === parseInt(coords[0]) && parseInt(w.col) === parseInt(coords[1]);
                })[0] || null
            };
        },

        initClues: function () {
            var self = this,
                horizotalClues,
                verticalClues,
                container, cluesCont, clueEl, frag, el, label;

            horizotalClues =  typeof this.options.clues.horizontal === 'function' ? this.options.clues.horizontal() : this.options.clues.horizontal;
            verticalClues =  typeof this.options.clues.vertical === 'function' ? this.options.clues.vertical() : this.options.clues.vertical;

            if (!horizotalClues.length || !verticalClues.length) {
                throw Error('Clues for the crossword are not set!');
            }

            container = typeof this.options.clues.container === 'string' ?
                document.querySelector(this.options.clues.container) : this.options.clues.container instanceof HTMLElement ?
                    this.options.clues.container : null;

            if (!container) {
                return;
            }

            this.cluesEl = document.createElement('div');
            this.cluesEl.appendChild(this.cluesEl.cloneNode(false));
            this.cluesEl.appendChild(this.cluesEl.cloneNode(false));
            cluesCont = document.createElement('ul');
            clueEl = document.createElement('li');
            label = document.createElement('h3');
            frag = document.createDocumentFragment();

            this.cluesEl.children[0].classList.add(CrossWord.CLASS_PREFIX + 'hclues');
            this.cluesEl.children[1].classList.add(CrossWord.CLASS_PREFIX + 'vclues');

            label.textContent = this.options.clues.labels.horizontal;
            label.classList.add(CrossWord.CLASS_PREFIX + 'clues-header');
            this.cluesEl.children[0].appendChild(label.cloneNode(true));

            for (var i = 0; i < horizotalClues.length; i++) {
                if (!this.wordNumbers.horizontal[i]) {
                    continue;
                }

                el = clueEl.cloneNode(false);
                el.innerHTML = '<span class="number">' + this.wordNumbers.horizontal[i].number + '.</span> ' + horizotalClues[i];
                el.setAttribute('id', this._unique_prefix.concat('clue-h-').concat(this.wordNumbers.horizontal[i].coords.join('-')));
                el.setAttribute('data-coords', this.wordNumbers.horizontal[i].coords.join(','));
                frag.appendChild(el);
            }

            cluesCont.appendChild(frag);
            cluesCont.classList.add(CrossWord.CLASS_PREFIX + 'clue-list');
            this.cluesEl.children[0].appendChild(cluesCont.cloneNode(true));

            cluesCont = document.createElement('ul');
            label = document.createElement('h3');
            label.classList.add(CrossWord.CLASS_PREFIX + 'clues-header');
            label.textContent = this.options.clues.labels.vertical;
            this.cluesEl.children[1].appendChild(label);
            for (var j = 0; j < verticalClues.length; j++) {
                if (!this.wordNumbers.vertical[j]) {
                    continue;
                }

                el = clueEl.cloneNode(false);
                el.innerHTML = '<span class="number">' + this.wordNumbers.vertical[j].number + '.</span> ' + verticalClues[j];
                el.setAttribute('id', this._unique_prefix.concat('clue-v-').concat(this.wordNumbers.vertical[j].coords.join('-')));
                el.setAttribute('data-coords', this.wordNumbers.vertical[j].coords.join(','));
                frag.appendChild(el);
            }

            cluesCont.appendChild(frag);
            cluesCont.classList.add(CrossWord.CLASS_PREFIX + 'clue-list');
            this.cluesEl.children[1].appendChild(cluesCont.cloneNode(true));
            this.cluesEl.classList.add(CrossWord.CLASS_PREFIX + 'clue-container');
            container.appendChild(this.cluesEl);

            this._cluesInitialized = true;
            this._initCluesEvents();

            return this.cluesEl;
        },

        _initCluesEvents: function () {
            var self = this;

            if (!this.cluesEl) {
                return;
            }

            this.cluesEl.addEventListener('click', (this._clueOnClick = function (ev) {
                var clueId = ev.target.getAttribute('id') || '',
                    coords = ev.target.dataset.coords.replace(',', 'x'),
                    isVertical = clueId.indexOf('-v-') !== -1,
                    currentWord = self.wordsHorizontal.concat(self.wordsVertical).filter(function (w) {
                        return coords === w.coords[0].join('x') &&  w.isVertical === isVertical;
                    })[0] || null;

                if (currentWord) {
                    self.highlight(currentWord.coords);
                    self._highlightClue([coords.split('x')], isVertical);
                    self.highlightState = isVertical ? CrossWord.HIGHLIGHT_VERTICAL : CrossWord.HIGHLIGHT_HORIZONTAL;
                    self._lettersMap[coords].cell.firstElementChild.focus();
                }

                ev.preventDefault();
                ev.stopPropagation();
                return false;
            }));
        },

        _highlightClue: function (coords, vertical) {
            var id  = '';

            if (!Array.isArray(coords)) {
                return;
            }

            vertical = vertical || false;
            id = this._unique_prefix + 'clue-' + (vertical ? 'v' : 'h') + '-' + coords[0].join('-');
            this.highlightedClue && this.highlightedClue.classList.remove('highlight');
            this.highlightedClue = document.getElementById(id);
            this.highlightedClue && this.highlightedClue.classList.add('highlight');
        },

        _initCrosswordEvents: function () {
            var self = this,
                isStartWordPosition = false;

            if (!this.crosswordEl) {
                return;
            }

            this._crosswordOnClick = function (ev) {
                var target = ev.target.parentElement,
                    coords = target.dataset.coords && target.dataset.coords.split(',').map(Number),
                    matchHorizontalPos = null,
                    matchVerticalPos = null,
                    currentWord = null,
                    highlightState = self.highlightState,
                    lastSelectedTiles = [];

                if (!coords) {
                    return;
                }

                // Check if any word start from the selected tile
                isStartWordPosition = self._isWordStart(coords);

                // Save last selected word coordinates
                lastSelectedTiles = [
                    self.highlightedTiles[0] && self.highlightedTiles[0].dataset.coords.split(',').map(Number),
                    self.highlightedTiles[0] && self.highlightedTiles[self.highlightedTiles.length-1].dataset.coords.split(',').map(Number)
                ];

                // Check if we are on the area of last selected word
                if (lastSelectedTiles[0]) {
                    if (!(
                            (lastSelectedTiles[0][0] <= coords[0] && coords[0] <= lastSelectedTiles[1][0]) &&
                            (lastSelectedTiles[0][1] <= coords[1] && coords[1] <= lastSelectedTiles[1][1])
                        )) {
                        highlightState = CrossWord.HIGHLIGHT_DEFAULT;
                    }
                }

                self.highlightState = (isStartWordPosition.horizontal && highlightState === CrossWord.HIGHLIGHT_DEFAULT) ?
                    CrossWord.HIGHLIGHT_HORIZONTAL : (isStartWordPosition.vertical && highlightState !== CrossWord.HIGHLIGHT_VERTICAL) ?
                        CrossWord.HIGHLIGHT_VERTICAL : (isStartWordPosition.vertical && highlightState === CrossWord.HIGHLIGHT_VERTICAL && !isStartWordPosition.horizontal) ?
                            CrossWord.HIGHLIGHT_HORIZONTAL : highlightState === CrossWord.HIGHLIGHT_DEFAULT ?
                                CrossWord.HIGHLIGHT_HORIZONTAL : highlightState === CrossWord.HIGHLIGHT_HORIZONTAL ?
                                    CrossWord.HIGHLIGHT_VERTICAL : CrossWord.HIGHLIGHT_DEFAULT;

                if (self.highlightState === CrossWord.HIGHLIGHT_HORIZONTAL) {
                    matchHorizontalPos = self.getHorizontalWord(coords);
                    currentWord = self.wordsHorizontal.filter(function (w) {
                        return matchHorizontalPos.join(',') === w.coords.join(',');
                    })[0] || null;
                    self.highlightState = currentWord ? self.highlight(currentWord.coords) && self.highlightState : CrossWord.HIGHLIGHT_VERTICAL;
                    self._cluesInitialized && self._highlightClue(currentWord && currentWord.coords, false);
                }

                if (self.highlightState === CrossWord.HIGHLIGHT_VERTICAL) {
                    matchVerticalPos = self.getVerticalWord(coords);
                    currentWord = self.wordsVertical.filter(function (w) {
                        return matchVerticalPos.join(',') === w.coords.join(',') ;
                    })[0] || null;
                    self.highlightState = currentWord ? self.highlight(currentWord.coords) && self.highlightState : CrossWord.HIGHLIGHT_DEFAULT;
                    self._cluesInitialized && self._highlightClue(currentWord && currentWord.coords, true);
                }

                if (self.highlightState === CrossWord.HIGHLIGHT_DEFAULT) {
                    self.clearHighlight();
                }

                self._elementOnFocus && self._elementOnFocus.classList.remove(CrossWord.CLASS_PREFIX + 'onfocus');
                self._elementOnFocus = target;
                self._elementOnFocus.classList.add(CrossWord.CLASS_PREFIX + 'onfocus');
                self._elementOnFocus.firstElementChild.focus();

                ev.preventDefault();
                ev.stopPropagation();
                return false;
            };

            this.crosswordEl.addEventListener('click', this._crosswordOnClick);
            this.crosswordEl.addEventListener('touchend', this._crosswordOnClick);

            this._crosswordOnKeydown = function (ev) {
                var code = null,
                    tileElement = null,
                    coords = [],
                    currentTile = null,
                    charEntered = '';
                ev.preventDefault();
                ev = ev ? ev : window.event;
                if (!ev) {
                    return true;
                }

                tileElement = ev.target.parentElement;
                coords = tileElement.dataset.coords.split(',').map(Number);
                currentTile = self._lettersMap[coords.join('x')];

                code = ev.which || ev.keyCode || ev.code || null;
                if (!code) {
                    return true;
                }

                //for android chrome keycode fix
                if (code === 0 || code === 229) {
                    code = ev.target.value.charCodeAt(ev.target.value.length - 1);
                }

                switch (code) {
                    case 46:
                    case 8:
                        // Backspace or Del
                        var moveBack = ev.target.value.length === 0;
                        ev.target.value = '';

                        if (
                            moveBack &&
                            ((self.highlightState === CrossWord.HIGHLIGHT_HORIZONTAL && currentTile.hasLeft) ||
                                (self.highlightState === CrossWord.HIGHLIGHT_VERTICAL && currentTile.hasUp))
                        ) {
                            self.highlightState === CrossWord.HIGHLIGHT_VERTICAL ? coords[0]-- : coords[1]--;
                            self._lettersMap[coords.join('x')].cell.firstElementChild.focus();
                        }
                        break;
                    case 37:
                        // Left
                        if (currentTile.hasLeft) {
                            coords[1]--;
                            self._lettersMap[coords.join('x')].cell.firstElementChild.focus();
                        }
                        break;
                    case 38:
                        // Top
                        if (currentTile.hasUp) {
                            coords[0]--;
                            self._lettersMap[coords.join('x')].cell.firstElementChild.focus();
                        }
                        break;
                    case 39:
                        // Right
                        if (currentTile.hasRight) {
                            coords[1]++;
                            self._lettersMap[coords.join('x')].cell.firstElementChild.focus();
                        }
                        break;
                    case 40:
                        // Down
                        if (currentTile.hasDown) {
                            coords[0]++;
                            self._lettersMap[coords.join('x')].cell.firstElementChild.focus();
                        }
                        break;
                    default:
                        charEntered = String.fromCharCode(code).toUpperCase();

                        // check if the key code is a letter one
                        if (/[0-9A-Z\u00c4\u00d6\u00dc\u00df]/i.test(charEntered)) {
                            ev.target.value = charEntered;

                            if (
                                (self.highlightState === CrossWord.HIGHLIGHT_HORIZONTAL && currentTile.hasRight) ||
                                (self.highlightState === CrossWord.HIGHLIGHT_VERTICAL && currentTile.hasDown)
                            ) {
                                self.highlightState === CrossWord.HIGHLIGHT_VERTICAL ? coords[0]++ : coords[1]++;
                                //self._lettersMap[coords.join('x')].cell.firstElementChild.focus();
                                self._getNextEmptyTile(coords).firstElementChild.focus();
                            }
                        }
                        break;
                }

                ev.preventDefault();
                ev.stopPropagation();
                return false;
            };

            this.crosswordEl.addEventListener('keyup', this._crosswordOnKeydown);

            window.addEventListener('resize', (this._onWindowResize = function (ev) {
                self._responsive.call(self, ev);
            }));
        },

        _responsive: function () {
            var rows = this.options.tableElement === 'table' ? this.crosswordEl.rows : this.crosswordEl.children,
                cols,
                size = parseFloat(this.crosswordEl.offsetWidth / rows[0].children.length).toFixed(1);

            for (var i = 0; i < rows.length; i++) {
                cols = this.options.tableElement === 'table' ? rows[i].cells : rows[i].children;
                for (var j = 0; j < cols.length; j++) {
                    cols[j].style.width = size + 'px';
                    cols[j].style.height = size + 'px';

                    if (cols[j].firstElementChild) {
                        cols[j].firstElementChild.style.fontSize = Math.floor(size) + 'px'
                    }
                }
            }
        },

        getCrosswordData: function () {
            var rows = this.crosswordEl.children,
                cols,
                data = '';

            for (var i = 0; i < rows.length; i++) {
                cols = rows[i].children;
                for (var j = 0; j < cols.length; j++) {
                    data += cols[j].firstElementChild ? (cols[j].firstElementChild.value || ' ') : this.options.blankChar;
                }
                data += "\n";
            }

            return data;
        },

        save: function (sessionId) {
            return localStorage.setItem(sessionId, b64EncodeUnicode(this.getCrosswordData()));
        },

        load: function (sessionId) {
            var decodedData = b64DecodeUnicode(localStorage.getItem(sessionId)),
                rows = this.crosswordEl.children,
                dataRows = decodedData.split("\n"),
                cols, dataCols;

            for (var i = 0; i < rows.length; i++) {
                dataCols = dataRows[i].split('');
                cols = rows[i].children;
                for (var j = 0; j < cols.length; j++) {
                    if (!cols[j].firstElementChild) {
                        continue;
                    }
                    cols[j].firstElementChild.value = (dataCols[j] === ' ' || dataCols[j] === this.options.blankChar) ? '' : (dataCols[j] || '');
                }
            }

            return decodedData;
        },

        clear: function () {
            var rows = this.crosswordEl.children,
                cols;

            for (var i = 0; i < rows.length; i++) {
                cols = rows[i].children;
                for (var j = 0; j < cols.length; j++) {
                    if (!cols[j].firstElementChild) {
                        continue;
                    }
                    cols[j].firstElementChild.value = '';
                }
            }
        },

        checkCurrentLetter: function () {
            if (!this._elementOnFocus) {
                return null;
            }

            return this._lettersMap[this._elementOnFocus.dataset.coords.replace(',', 'x')].char === this._elementOnFocus.value;
        },

        checkCurrentWord: function () {
            if (!this.highlightedTiles) {
                return null;
            }

            for (var i = 0;i < this.highlightedTiles.length; i++) {
                if (this._lettersMap[this.highlightedTiles[i].dataset.coords.replace(',', 'x')].char !== this.highlightedTiles[i].firstElementChild.value) {
                    return false;
                }
            }

            return true;
        },

        checkCrossword: function () {
            return this.options.data === this.getCrosswordData();
        },

        exportAsImage: function () {
            var canvas = document.createElement('canvas'),
                context = canvas.getContext("2d"),
                rows = this.options.tableElement === 'table' ? this.crosswordEl.rows : this.crosswordEl.children,
                squareSize = 40,
                crosswordWidth = squareSize * rows[0].children.length,
                crosswordHeight = squareSize * rows.length,
                cluesHeight = (this.options.clues.horizontal ? this.options.clues.horizontal.length + this.options.clues.vertical.length : 0) * 24 + 100,
                canvasWidth = crosswordWidth,
                canvasHeight = Math.max(crosswordHeight, cluesHeight),
                text = '',
                currentLine = 0;

            canvas.setAttribute('width', canvasWidth + 400);
            canvas.setAttribute('height', canvasHeight);
            context.clearRect(0, 0, context.width, context.height);

            for (var i = 0; i < rows.length; i++) {
                var cells = this.options.tableElement === 'table' ? rows[i].cells : rows[i].children;
                for (var j = 0; j < cells.length; j++) {
                    var tileColor = cells[j].classList.contains('special-tile') ? '#fde9ab' : cells[j].classList.contains('yncw-blank') ? '#273b44' : '#F4F4F4';
                    var number = cells[j].getElementsByTagName('span');
                    drawSquare(context, j * squareSize, i * squareSize, squareSize, squareSize, tileColor, tileColor === '#F4F4F4' ? '#DDDDDD' : '#FFFFFF');

                    context.fillStyle = 'black';
                    number[0] && context.fillText(number[0].textContent, (j * squareSize) + 3, (i * squareSize) + 12);
                }
            }

            context.font = "bold 18px sans-serif";
            context.fillText('Across', canvasWidth + 20, 30);

            context.font = "12px sans-serif";
            for (var hi = 0; hi < this.options.clues.horizontal.length; hi++) {
                text = this.wordNumbers.horizontal[hi].number + '. ' + this.options.clues.horizontal[hi];
                context.fillText(text, canvasWidth + 20, (currentLine = 60 + (hi*24)));
            }

            context.font = "bold 18px sans-serif";
            context.fillText('Down', canvasWidth + 20, currentLine += 50);

            context.font = "12px sans-serif";
            for (var vi = 0; vi < this.options.clues.horizontal.length; vi++) {
                text = this.wordNumbers.vertical[vi].number + '. ' + this.options.clues.vertical[vi];
                context.fillText(text, canvasWidth + 20, currentLine + 30 + (vi*24));
            }

            //document.body.appendChild(canvas);
            return canvas.toDataURL("image/jpeg", 1.0);
        },

        exportAsCSV: function () {
            var csvText = [],
                rows = this.options.tableElement === 'table' ? this.crosswordEl.rows : this.crosswordEl.children;

            for (var i = 0; i < rows.length; i++) {
                var cells = this.options.tableElement === 'table' ? rows[i].cells : rows[i].children;
                csvText[i] = [];
                for (var j = 0; j < cells.length; j++) {
                    csvText[i].push((this._lettersMap[i + 'x' + j].special ? this.options.highlightChar : '') + this._lettersMap[i + 'x' + j].char);
                }
                csvText[i] = csvText[i].join(',');
            }

            return encodeURI("data:text/csv;charset=utf-8," + csvText.join("\r\n"));
        },

        destroy: function () {
            this.specialTiles = [];
            this.wordsHorizontal = [];
            this.wordsVertical = [];
            this.wordNumbers = {horizontal: [], vertical: []};
            this.highlightedTiles = [];
            this.highlightState = '';
            this._cluesInitialized = false;

            if (this.crosswordEl) {
                window.removeEventListener('resize', this._onWindowResize);
                this.crosswordEl.removeEventListener('click', this._crosswordOnClick);
                this.crosswordEl.removeEventListener('touchend', this._crosswordOnClick);
                this.crosswordEl.removeEventListener('keyup', this._crosswordOnKeydown);
                this._clueOnClick && this.cluesEl.removeEventListener('click', this._clueOnClick);
                this.crosswordEl.parentElement.removeChild(this.crosswordEl);

                if (this._fromTable) {
                    this._fromTablePlace.parentElement.insertBefore(this._fromTable, this._fromTablePlace.nextElementSibling);
                    this._fromTablePlace.parentElement.removeChild(this._fromTablePlace);
                    this.options.data = this._fromTable;
                }

                if (this.cluesEl) {
                    this.cluesEl.parentElement.removeChild(this.cluesEl);
                }
            }
        }
    };

    // Add support for AMD (Asynchronous Module Definition) libraries such as require.js.
    if (typeof define === 'function' && define.amd) {
        define([], function() {
            return {
                CrossWord: CrossWord
            };
        });
    }

    // Add support for CommonJS libraries such as browserify.
    if (typeof exports !== 'undefined') {
        exports.CrossWord = CrossWord;
    }

    // Define globally in case AMD is not available or unused.
    if (typeof window !== 'undefined') {
        window.CrossWord = CrossWord;
    } else if (typeof global !== 'undefined') { // Add to global in Node.js (for testing, etc).
        global.CrossWord = CrossWord;
    }
})(window, document);
