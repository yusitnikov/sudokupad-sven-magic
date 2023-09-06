// ==UserScript==
// @name         SudokuPad Sven Magic
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  Add a button that resolves all singles in SudokuPad
// @author       Chameleon
// @updateURL    https://github.com/yusitnikov/sudokupad-sven-magic/raw/main/sudokupad-sven-magic.user.js
// @match        https://crackingthecryptic.com/*
// @match        https://*.crackingthecryptic.com/*
// @match        https://sudokupad.app/*
// @match        https://*.sudokupad.app/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=app.crackingthecryptic.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

window.addEventListener('DOMContentLoaded', () => {
    let initialized = false;
    const init = () => {
        if (initialized) {
            return;
        }
        initialized = true;

        const animationSpeed = 500;
        const {app} = Framework;
        const sven = document.getElementById('svenpeek');
        const styles = getComputedStyle(sven);


        const deselect = () => app.act({type: 'deselect'});
        const select = (cells) => {
            deselect();
            if (cells.length) {
                app.act({type: 'select', arg: cells});
            }
        };

        let isInTransaction = false;
        const transaction = (callback) => {
            if (isInTransaction) {
                return callback();
            }

            isInTransaction = true;
            const prevSelectedCells = [...app.puzzle.selectedCells];
            app.act({type: 'groupstart'});

            try {
                return callback();
            } finally {
                isInTransaction = false;
                select(prevSelectedCells);
                app.act({type: 'groupend'});
            }
        };

        const cleanUp = (applyToCells = app.grid.getCellList()) => transaction(() => {
            const conflicts = app.puzzle.check(['pencilmarks']);

            for (const {prop, cells, val} of conflicts) {
                const type = prop === 'centre' ? 'candidates' : 'pencilmarks';
                select(cells.filter(cell => applyToCells.includes(cell) && cell[type].includes(val)));
                app.act({type, arg: val});
            }

            return conflicts.length > 0;
        });

        const acceptSingles = () => transaction(() => {
            let changed = false;

            for (const cell of app.grid.getCellList()) {
                if (!cell.value && !cell.given && cell.candidates && cell.candidates.length === 1) {
                    select([cell]);
                    app.act({type: 'value', arg: cell.candidates[0]});
                    changed = true;
                }
            }

            return changed;
        });

        const markAll = () => transaction(() => {
            const cells = app.grid.getCellList();
            const selectedCells = [...app.puzzle.selectedCells];
            const emptyCell = cells.find(cell => !cell.given && !cell.value);
            const digits = [
                ...new Set(cells.flatMap(cell => {
                    const value = cell.given ?? cell.value ?? undefined;
                    return value !== undefined ? [value] : [...cell.candidates, ...cell.pencilmarks];
                })
                    .filter(Boolean))
            ];

            const isFillableCell = cell => !cell.given && !cell.value && !cell.candidates.length && !cell.pen.some(p => p[0] === 't');
            let fillableCells = selectedCells.filter(isFillableCell);
            const isUsingSelectedCells = fillableCells.length !== 0
                // there are selected cells with conflicts - the Mark button could fix them
                || app.puzzle.check(['pencilmarks']).some(({cells}) => cells.some(cell => selectedCells.includes(cell)))
                // user chose to mark only the selected cells no matter what in the settings
                || (Framework.getSetting(selectedOnlySetting.name) && selectedCells.length !== 0);
            if (!isUsingSelectedCells) {
                fillableCells = cells.filter(isFillableCell);
            }
            select(fillableCells);
            for (const digit of digits) {
                app.act({type: 'candidates', arg: digit});
            }

            cleanUp(isUsingSelectedCells ? selectedCells : cells);
        });

        const doMagic = () => transaction(() => {
            for (let i = 0; i < 100; i++) {
                const cleaned = cleanUp();
                const accepted = acceptSingles();
                if (!cleaned && !accepted) {
                    break;
                }
            }
        });


        const createButton = (title, onClick, options = {}) => {
            const sven2 = document.createElement('div');
            for (const key of ['width', 'height', 'background', 'backgroundImage', 'position', 'zIndex']) {
                sven2.style[key] = options[key] = options[key] ?? styles[key];
            }
            sven2.style.bottom = sven2.style.left = sven2.style.right = 0;
            sven2.style.margin = '0px auto 1rem';
            sven2.style.transition = animationSpeed + 'ms ease all';

            const toggle = show => {
                sven2.style.backgroundPosition = 'center ' + (show ? '0px' : options.height);
            }
            toggle(false);

            sven.parentElement.appendChild(sven2);

            Framework.addAuxButton({
                name: title.replace(/ /g, '').toLowerCase(),
                title,
                content: `<div class="icon" style="width: 3.5rem; height: 3.5rem; background: ${options.backgroundImage.replace(/"/g, "'")} no-repeat center center; background-size: cover"></div>${title}`,
                onClick() {
                    toggle(true);
                    setTimeout(() => {
                        setTimeout(() => toggle(false), 1);
                        onClick();
                    }, animationSpeed);
                },
            });
        };

        createButton('Mark it', markAll, {
            width: '174px',
            height: '125px',
            backgroundImage: 'url("https://i.gyazo.com/4080ac270e344efa60f2978db88f6ba6.png")'
        });
        createButton('Sven it', doMagic);

        const selectedOnlySetting = {
            tag: 'toggle',
            group: 'gameplay',
            name: 'markbutton_selected',
            content: 'Apply Mark button only to selected cells',
        };
        Framework.addSetting(selectedOnlySetting);
    }

    if (typeof Framework !== "undefined" && Framework.getApp) {
        Framework.getApp().then(init);
    }
});
