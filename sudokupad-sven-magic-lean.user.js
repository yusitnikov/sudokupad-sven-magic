// ==UserScript==
// @name         SudokuPad Sven Magic (lean version)
// @namespace    http://tampermonkey.net/
// @version      0.10
// @description  Add a button that resolves all singles in SudokuPad
// @author       Chameleon
// @updateURL    https://github.com/yusitnikov/sudokupad-sven-magic/raw/main/sudokupad-sven-magic-lean.user.js
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

        const getCellValue = (cell) => {
            // "hideclue" flag means that the given digit is not currently visible because of FoW - we should ignore such a given
            if (cell.given && !cell.hideclue) {
                return cell.given;
            }

            return cell.value ?? undefined;
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
                if (!getCellValue(cell) && cell.candidates && cell.candidates.length === 1) {
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
            const emptyCell = cells.find(cell => !getCellValue(cell));
            const digits = [
                ...new Set(cells.flatMap(cell => {
                    const value = getCellValue(cell);
                    return value !== undefined ? [value] : [...cell.candidates, ...cell.pencilmarks];
                })
                    .filter(Boolean))
            ];

            const isFillableCell = cell => !getCellValue(cell) && !cell.candidates.length && !cell.pen.some(p => p[0] === 't');
            let fillableCells = selectedCells.filter(isFillableCell);
            const isUsingSelectedCells = fillableCells.length !== 0;
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


        const createButton = (title, onClick, backgroundImage) => {
            Framework.addAuxButton({
                name: title.replace(/ /g, '').toLowerCase(),
                title,
                content: `<div class="icon" style="width: 3.5rem; height: 3.5rem; background: ${backgroundImage.replace(/"/g, "'")} no-repeat center center; background-size: cover"></div>${title}`,
                onClick,
            });
        };

        createButton('Mark it', markAll, 'url("https://i.gyazo.com/4080ac270e344efa60f2978db88f6ba6.png")');
        createButton('Sven it', doMagic, 'url("https://sudokupad.app/images/svencodes_peek.png")');
    }

    if (typeof Framework !== "undefined" && Framework.getApp) {
        Framework.getApp().then(init);
    }
});
