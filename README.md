Crossword - Javascript
====================

A browser-based crossword puzzle implemented in JavaScript.

## Usage
```javascript
var crossWord = new new CrossWord({
                    container: '.crossword-container',
                    data: data
                });
```

## Options
### `blankChar {String}`

The char which will be treat as a blank field in the crossword

**Default**: `'#'`

### `highlightChar {String}`

Highlight specific tile in the crossword

**Default**: `'@'`

### `data {String|HTMLTableElement|Function}`

The data

**Default**: `null`

### `format {String}`

The format of the data for the crossword (text or csv)

**Default**: `text`

### `container {String|HTMLElement}`

The container where the crossword will be placed

**Default**: `null`

### `minWordChar {Number}`

The minimum chars after which the string will be marked as a word

**Default**: `2`

### `minWordChar {Number}`

clues: {
    id: null,
    labels: {
        horizontal: 'Across',
        vertical: 'Down'
    },
    horizontal: [],
    vertical: []
}

The clues object

**Default**: `
clues: {
    container: null, // the container where the clues will be placed {String|HTMLElement}
    labels: {
        horizontal: 'Across', // label {String}
        vertical: 'Down' // label {String}
    },
    horizontal: [], // Clue list {String[]}
    vertical: [] // Clue list {String[]}
}
`

## Data formats

```javascript
    var dataText = ['RECIPROCA#IMAM#REALTA',
                    'ABATE#VASSOIO#COMFORT',
                    'YALE#DENSITA#NOT#AGIO',
                    'BNL#LESTI#A#POREC#OPM',
                    'RO#MENTORE#CARPALE#LO',
                    'A#IAGO#RICCARDOTERZO#',
                    'DANNATI#ACANZI#ATEA#C',
                    'BRENTANO#ELOISA#OMNIA',
                    'UTS#ATENE#ANATRA#ITCS',
                    'RI#PROROGA#ILARCA#ETA',
                    'Y#LEI#TROPICI#ARIE#UT',
                    '#LITANIE#REO#PSORIASI'].join("\n");

    var crossWord = new new CrossWord({
        ...
        data: dataText,
        ...
    });

    // You can create your crossword in Excel then export it to CSV format
    var dataCSV = ['R,E,C,I,P,R,O,C,A,#,I,M,A,M,#,R,E,A,L,T,A',
                  'A,B,A,T,E,#,V,A,S,S,O,I,O,#,C,O,M,F,O,R,T',
                  'Y,A,L,E,#,D,E,N,S,I,T,A,#,N,O,T,#,A,G,I,O',
                  'B,N,L,#,L,E,S,T,I,#,A,#,P,O,R,E,C,#,O,P,M',
                  'R,O,#,M,E,N,T,O,R,E,#,C,A,R,P,A,L,E,#,L,O',
                  'A,#,I,A,G,O,#,R,I,C,C,A,R,D,O,T,E,R,Z,O,#',
                  'D,A,N,N,A,T,I,#,A,C,A,N,Z,I,#,A,T,E,A,#,C',
                  'B,R,E,N,T,A,N,O,#,E,L,O,I,S,A,#,O,M,N,I,A',
                  'U,T,S,#,A,T,E,N,E,#,A,N,A,T,R,A,#,I,T,C,S',
                  'R,I,#,P,R,O,R,O,G,A,#,I,L,A,R,C,A,#,E,T,A',
                  'Y,#,L,E,I,#,T,R,O,P,I,C,I,#,A,R,I,E,#,U,T',
                  '#,L,I,T,A,N,I,E,#,R,E,O,#,P,S,O,R,I,A,S,I'].join("\n");
    // you have to set in the options
    var crossWord = new new CrossWord({
        ...
        data: dataCSV,
        format: 'csv',
        ...
    });

    // You can create HTML Table and provide it to in the options
    var crossWord = new new CrossWord({
        ...
        data: document.getElementById('crossword-table'),
        ...
    });
```