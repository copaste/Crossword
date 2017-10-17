(function (window, document) {
    'use strict';

    // TODO: 1. highlight crossword on hover/click on a clue
    // TODO: 3. implement check function
    // TODO: 4. highlight the wrong words with red ?!?

    function CrossWord (options) {
        var defaultOptions = {
            blankChar: '#',
            highlightChar: '@',
            data: null,
            format: 'txt',
            container: null,
            minWordChar: 2,
            clues: {
                id: null,
                labels: {
                    horizontal: 'Across',
                    vertical: 'Down'
                },
                horizontal: [],
                vertical: []
            }
        };

        this.crosswordEl = null;
        this.wordNumbers = {horizontal: [], vertical: []};
        this.highlightedTiles = [];
        this.specialTiles = [];
        this.highlightState = '';
        this.cluesInitialized = false;
        this.highlightedClue;
        this.isFromTable = false;

        this.options = merge2Objects(defaultOptions, options);
    }

    function  merge2Objects (obj1, obj2) {
        var temp = {};

        if (toString.call(obj1) !== '[object Object]') {
            return temp;
        }

        obj2 = obj2 || {};

        Object.keys(obj1).map(function (k) {
            if (!obj2.hasOwnProperty(k)) {
                temp[k] = toString.call(obj1[k]) === '[object Object]' ? merge2Objects(obj1[k], obj2[k]) : obj1[k];
            } else {
                temp[k] = toString.call(obj1[k]) === '[object Object]' ? merge2Objects(obj1[k], obj2[k]) : obj2[k];
            }
        });

        return temp;
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

            if (this.options.data instanceof HTMLTableElement) {
                this.options.data = this.buildFromTable(this.options.data);
                this.isFromTable = true;
            }

            if (typeof this.options.data === 'function') {
                this.options.data = this.options.data();
            }

            if (this.options.data.split("\n").length < 3) {
                throw Error('The provided data is not in the correct format!');
            }

            this.options.container = typeof this.options.container === 'string' ?
                document.querySelector(this.options.container) : (this.options.container instanceof HTMLElement ? this.options.container : null);

            if (!this.options.container) {
                throw Error('The "container" property in the options should be string or HTMLElement, ' + typeof this.options.container + ' given!');
            }

            this.options.data = this.balanceRows(this.options.data);
            this.specialTiles = this.getSpecialTiles();

            if (this.specialTiles.length > 0) {
                this.options.data = this.balanceRows(this.options.data);
            }

            this.rowsText = this.options.data.split("\n");
            this.colsText = this.getColsText(this.rowsText);
            this.wordsHorizontal = this.getWords(this.rowsText);
            this.wordsVertical = this.getWords(this.colsText, true);
            this.letters = this.mapLetters(this.rowsText);
            this.crosswordEl = this.create(this.rowsText);
            this.addNumbers();
            this.initEvents();
        },

        getColsText: function (rows) {
            var rowLetters = [],
                colWords = [],
                len = rows[0].length;

            for (var i = 0; i < rows.length; i++) {
                rowLetters[i] = rows[i].split('');
            }

            for (var j = 0; j < len; j++) {
                colWords[j] = [];
                for (var g = 0; g < len; g++) {
                    colWords[j] += rowLetters[g] && rowLetters[g][j] || '';
                }
            }

            return colWords;
        },

        getWords: function (rows, vertical) {
            var wordList = [];
                vertical = vertical || false;

            for (var i = 0; i < rows.length; i++) {
                var words = rows[i].split(this.options.blankChar);

                for (var j = 0; j < words.length; j++) {
                    if (words[j] && words[j].length > this.options.minWordChar - 1) {
                        var wordStart = rows[i].indexOf(words[j]);
                        var start = [i, wordStart];
                        var end = [i, wordStart + words[j].length-1];

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

        mapLetters: function (rows) {
            var map = {},
                rowsLen = rows.length;

            for (var i = 0; i < rowsLen; i++) {
                var chars = rows[i].split('');
                var charsLen = chars.length;
                var nextRowChars = (rows[i+1] || '').split('');
                var prevRowChars = (rows[i-1] || '').split('');

                for (var j = 0; j < chars.length; j++) {
                    map[i+'-'+j] = {
                        char: chars[j],
                        row: i,
                        col: j,
                        isSpecial: this.specialTiles.indexOf(i + ',' + j) !== -1,
                        blank: chars[j].trim() === this.options.blankChar,
                        hasLeft: j > 0 && chars[j - 1].replace(this.options.blankChar,'').length > 0,
                        hasRight: j < (charsLen - 1) && chars[j+1].replace(this.options.blankChar,'').length > 0,
                        hasUp: i > 0 && prevRowChars[j].trim().replace(this.options.blankChar,'').length > 0,
                        hasDown: i < (rowsLen - 1) && nextRowChars[j].trim().replace(this.options.blankChar,'').length > 0
                    }
                }
            }

            return map;
        },

        balanceRows: function (data) {
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

        buildFromTable: function (table) {
            var rows, cols, data = [];

            if (!table instanceof HTMLTableElement) {
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

            table.parentElement.removeChild(table);

            return data.join("\n");
        },

        create: function (rows) {
            var frag = document.createDocumentFragment();
            var table = document.createElement('table');
            var row = document.createElement('tr');
            var cell = document.createElement('td');
            var input = document.createElement('input');

            input.setAttribute('maxlength', 1);
            input.setAttribute('tabindex', -1);

            table.classList.add(CrossWord.CLASS_PREFIX + 'crossword');
            frag.appendChild(table);

            for (var i = 0; i < rows.length; i++) {
                var chars = rows[i].split('');
                var r = row.cloneNode(false);

                table.appendChild(r);

                for (var j = 0; j < chars.length; j++) {
                    var c = cell.cloneNode(false);

                    c.setAttribute('data-coords', i + ',' + j);
                    c.setAttribute('id', 'p-' + i + '-' + j);
                    c.classList.add('p-' + i + '-' + j);
                    c.classList.add(CrossWord.CLASS_PREFIX + (chars[j] !== this.options.blankChar ? 'letter':'blank'));
                    this.specialTiles.indexOf(i + ',' + j) !== -1 && c.classList.add('special-tile');

                    c.classList.contains(CrossWord.CLASS_PREFIX + 'letter') && c.appendChild(input.cloneNode(false));
                    r.appendChild(c);
                }
            }

            this.options.container.appendChild(frag);

            return table;
        },

        getHorizontalWord: function (currentMarkerCoords) {
            var coords = currentMarkerCoords;
            var row = coords[0];
            var col = coords[1];

            if (this.letters[coords[0]+'-'+col].hasLeft) {
                --col;
                return this.getHorizontalWord([row, col]);
            }

            while (this.letters[coords[0]+'-'+col] && this.letters[coords[0]+'-'+col].blank === false) {
                col++;
            }

            //return [coords[1], col-1];
            return [[row, coords[1]], [row, col-1]];
        },

        getVerticalWord: function (currentMarkerCoords) {
            var coords = currentMarkerCoords;
            var row = coords[0];
            var col = coords[1];

            if (this.letters[row+'-'+coords[1]].hasUp) {
                --row;
                return this.getVerticalWord([row, col]);
            }

            while (this.letters[row+'-'+coords[1]] && this.letters[row+'-'+coords[1]].blank === false) {
                ++row;
            }

            //return [coords[0], row-1];
            return [[coords[0], col], [row-1, col]];
        },

        getSpecialTiles: function () {
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

        addNumbers: function() {
            var self = this,
                boxClasses = [],
                span = document.createElement('span'),
                counter = 0,
                wordList = this.wordsHorizontal.concat(this.wordsVertical);

            for (var i = 0; i < wordList.length; i++) {
                boxClasses.push('p-' + wordList[i].coords[0].join('-'));
            }

            // Sort the words by row
            boxClasses = boxClasses.sort(function(a, b) {
                var aa = a.replace('p-', '').split('-').map(Number),
                    bb = b.replace('p-', '').split('-').map(Number);

                return aa[0] > bb[0] ? 1 : (bb[0] > aa[0] ? -1 : (aa[1] > bb[1] ? 1 : (bb[1] > aa[1] ? -1 : 0)));
            })
            .filter(function (value, index, self) {
                return self.indexOf(value) === index;
            });

            boxClasses.map(function (id) {
                var s = span.cloneNode(false),
                    word = self.isWordStart(id.replace('p-','').split('-'));

                s.textContent = (++counter) + '';
                document.getElementById(id).appendChild(s);

                word.horizontal && self.wordNumbers.horizontal.push({coords: word.horizontal.coords[0], number: counter});
                word.vertical && self.wordNumbers.vertical.push({coords: word.vertical.coords[0], number: counter});
            });
        },

        highlight: function (coords) {
            var selectedTiles = [];

            if (!Array.isArray(coords) || coords.length !== 2) {
                return;
            }

            for (var i = coords[0][0]; i < coords[1][0]+1; i++) {
                for (var j = coords[0][1]; j < coords[1][1]+1; j++) {
                    selectedTiles.push('p-' + i + '-' + j);
                }
            }

            this.clearHighlight();
            this.highlightedTiles = selectedTiles.map(function (id) {
                var el = document.getElementById(id);
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

        isHorizontalWordFilled: function (coords) {
            var wordCoords = this.getHorizontalWord(coords);

            for (var i = wordCoords[0][0]; i < wordCoords[1][0]+1; i++) {
                for (var j = wordCoords[0][1]; j < wordCoords[1][1]+1; j++) {
                    if (document.getElementById('p-' + i + '-' + j).firstElementChild.value.length === 0) {
                        return false;
                    }
                }
            }

            return true;
        },

        isVerticalWordFilled: function (coords) {
            var wordCoords = this.getVerticalWord(coords);

            for (var i = wordCoords[0][0]; i < wordCoords[1][0]+1; i++) {
                for (var j = wordCoords[0][1]; j < wordCoords[1][1]+1; j++) {
                    if (document.getElementById('p-' + i + '-' + j).firstElementChild.value.length === 0) {
                        return false;
                    }
                }
            }

            return true;
        },

        isWordStart: function (coords) {
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
            var container, cluesCont, clueEl, frag, el, label;

            if (!this.options.clues.horizontal.length || !this.options.clues.vertical.length) {
                throw Error('Clues for the crossword are not set!');
            }

            container = typeof this.options.clues.id === 'string' ?
                document.querySelector(this.options.clues.id) : this.options.clues.id instanceof HTMLElement ?
                    this.options.clues.id : false;

            if (container===false) {
                return;
            }

            cluesCont = document.createElement('ul');
            clueEl = document.createElement('li');
            label = document.createElement('h3');
            frag = document.createDocumentFragment();

            label.textContent = this.options.clues.labels.horizontal;
            label.classList.add(CrossWord.CLASS_PREFIX + 'clues-header');
            container.appendChild(label.cloneNode(true));

            for (var i = 0; i < this.options.clues.horizontal.length; i++) {
                el = clueEl.cloneNode(false);
                el.textContent = this.wordNumbers.horizontal[i].number + '. ' + this.options.clues.horizontal[i];
                el.setAttribute('id', CrossWord.CLASS_PREFIX.concat('clue-h-').concat(this.wordNumbers.horizontal[i].coords.join('-')));
                frag.appendChild(el);
            }

            cluesCont.appendChild(frag);
            cluesCont.classList.add(CrossWord.CLASS_PREFIX + 'horizontal-clues');
            container.appendChild(cluesCont.cloneNode(true));

            cluesCont = document.createElement('ul');
            label = document.createElement('h3');
            label.textContent = this.options.clues.labels.vertical;
            container.appendChild(label);
            for (var j = 0; j < this.options.clues.vertical.length; j++) {
                el = clueEl.cloneNode(false);
                el.textContent = this.wordNumbers.vertical[j].number + '. ' + this.options.clues.vertical[j];
                el.setAttribute('id', CrossWord.CLASS_PREFIX.concat('clue-v-').concat(this.wordNumbers.vertical[j].coords.join('-')));
                frag.appendChild(el);
            }

            cluesCont.appendChild(frag);
            cluesCont.classList.add(CrossWord.CLASS_PREFIX + 'vertical-clues');
            container.appendChild(cluesCont.cloneNode(true));
            container.classList.add(CrossWord.CLASS_PREFIX + 'clue-container');

            this.cluesInitialized = true;

            return container;
        },

        highlightClue: function (coords, vertical) {
            var id  = '';

            if (!Array.isArray(coords)) {
                return;
            }

            vertical = vertical || false;
            id = CrossWord.CLASS_PREFIX + 'clue-' + (vertical ? 'v' : 'h') + '-' + coords[0].join('-');
            this.highlightedClue && this.highlightedClue.classList.remove('highlight');
            this.highlightedClue = document.getElementById(id);
            this.highlightedClue && this.highlightedClue.classList.add('highlight');
        },

        initEvents: function () {
            var self = this,
                isStartWordPosition = false;

            if (!this.crosswordEl) {
                return;
            }

            this.crosswordEl.addEventListener('click', function crosswordOnClick (ev) {
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
                isStartWordPosition = self.isWordStart(coords);

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
                    self.cluesInitialized && self.highlightClue(currentWord && currentWord.coords, false);
                }

                if (self.highlightState === CrossWord.HIGHLIGHT_VERTICAL) {
                    matchVerticalPos = self.getVerticalWord(coords);
                    currentWord = self.wordsVertical.filter(function (w) {
                        return matchVerticalPos.join(',') === w.coords.join(',') ;
                    })[0] || null;
                    self.highlightState = currentWord ? self.highlight(currentWord.coords) && self.highlightState : CrossWord.HIGHLIGHT_DEFAULT;
                    self.cluesInitialized && self.highlightClue(currentWord && currentWord.coords, true);
                }

                if (self.highlightState === CrossWord.HIGHLIGHT_DEFAULT) {
                    self.clearHighlight();
                }

                ev.preventDefault();
                ev.stopPropagation();
                return false;
            });

            this.crosswordEl.addEventListener('keydown', function crosswordOnClick (ev) {
                var code = null,
                    tileElement = null,
                    coords = [],
                    currentTile = null,
                    charEntered = '';

                ev = ev ? ev : window.event;
                if (!ev) {
                    return true;
                }

                tileElement = ev.target.parentElement;
                coords = tileElement.dataset.coords.split(',').map(Number);
                currentTile = self.letters[coords.join('-')];

                code = ev.keyCode || ev.which || null;
                if (!code) {
                    return true;
                }

                switch (code) {
                    case 8:
                        // Backspace
                        tileElement.firstElementChild.value = '';

                        if (
                            (self.highlightState === CrossWord.HIGHLIGHT_HORIZONTAL && currentTile.hasLeft) ||
                            (self.highlightState === CrossWord.HIGHLIGHT_VERTICAL && currentTile.hasUp)
                        ) {
                            self.highlightState === CrossWord.HIGHLIGHT_VERTICAL ? coords[0]-- : coords[1]--;
                            document.getElementById('p-' + coords.join('-')).firstElementChild.focus();
                        }
                        break;
                    case 37:
                        // Left
                        if (currentTile.hasLeft) {
                            coords[1]--;
                            document.getElementById('p-' + coords.join('-')).firstElementChild.focus();
                        }
                        break;
                    case 38:
                        // Top
                        if (currentTile.hasUp) {
                            coords[0]--;
                            document.getElementById('p-' + coords.join('-')).firstElementChild.focus();
                        }
                        break;
                    case 39:
                        // Right
                        if (currentTile.hasRight) {
                            coords[1]++;
                            document.getElementById('p-' + coords.join('-')).firstElementChild.focus();
                        }
                        break;
                    case 40:
                        // Down
                        if (currentTile.hasDown) {
                            coords[0]++;
                            document.getElementById('p-' + coords.join('-')).firstElementChild.focus();
                        }
                        break;
                    default:
                        charEntered = String.fromCharCode(code).toUpperCase();

                        // check if the key code is a letter one
                        if (/[A-Z\u00c4\u00d6\u00dc\u00df]/i.test(charEntered)) {
                            tileElement.firstElementChild.value = charEntered;

                            if (
                                (self.highlightState === CrossWord.HIGHLIGHT_HORIZONTAL && currentTile.hasRight) ||
                                (self.highlightState === CrossWord.HIGHLIGHT_VERTICAL && currentTile.hasDown)
                            ) {
                                self.highlightState === CrossWord.HIGHLIGHT_VERTICAL ? coords[0]++ : coords[1]++;
                                document.getElementById('p-' + coords.join('-')).firstElementChild.focus();
                            }
                        }
                        break;
                }

                ev.preventDefault();
                ev.stopPropagation();
                return false;
            });
        }
    };

    window.CrossWord = CrossWord;


    function testPerf (callback, times) {
        var start = Date.now();

        for (var i = 0; i < times; i++) {
            callback();
        }

        var end = Date.now();

        return end - start;
    }

    // Test the performance of getDocumentById vs. querySelectorAll with multiple selectors
    //
    setTimeout(function () {
        return;
        var t1 = testPerf(function() {
            "#p-4-0,#p-4-1,#p-4-2,#p-4-3,#p-4-4,#p-4-5,#p-4-6".split(',').map(function (t) {
                document.getElementById(t.replace('#', '')).classList.contains('lettter');
            });
        }, 100000);

        var t2 = testPerf(function() {
            var els = document.querySelectorAll("#p-4-0,#p-4-1,#p-4-2,#p-4-3,#p-4-4,#p-4-5,#p-4-6");
            for (var i = 0; i < els.length; i++) {
                els[i].classList.contains('letter');
            }
        }, 100000);

        console.log(t1, t2);
    });


    /*
    self.highlightState = (isStartWordPosition.horizontal && highlightState === CrossWord.HIGHLIGHT_DEFAULT) ?
                    CrossWord.HIGHLIGHT_HORIZONTAL : (isStartWordPosition.vertical && highlightState !== CrossWord.HIGHLIGHT_VERTICAL) ?
                        CrossWord.HIGHLIGHT_VERTICAL : (isStartWordPosition.vertical && highlightState === CrossWord.HIGHLIGHT_VERTICAL && !isStartWordPosition.horizontal) ?
                            CrossWord.HIGHLIGHT_HORIZONTAL : highlightState === CrossWord.HIGHLIGHT_DEFAULT ?
                                CrossWord.HIGHLIGHT_HORIZONTAL : highlightState === CrossWord.HIGHLIGHT_HORIZONTAL ?
                                    CrossWord.HIGHLIGHT_VERTICAL : CrossWord.HIGHLIGHT_DEFAULT;
     */
})(window, document);