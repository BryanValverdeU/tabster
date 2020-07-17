/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Keys } from '../Keys';
import { Subscribable } from './Subscribable';
import * as Types from '../Types';

const _dismissTimeout = 500; // When Esc is pressed and the focused is not moved
                             // during _dismissTimeout time, dismiss the keyboard
                             // navigation mode.

export class KeyboardNavigationState extends Subscribable<boolean> implements Types.KeyboardNavigationState {
    private _ah: Types.AbilityHelpers;
    private _mainWindow: Window;
    private _dismissTimer: number | undefined;
    private _initTimer: number | undefined;
    private _isMouseUsed = false;

    constructor(ah: Types.AbilityHelpers, mainWindow: Window) {
        super();

        this._ah = ah;
        this._mainWindow = mainWindow;
        this._initTimer = this._mainWindow.setTimeout(this._init, 0);
    }

    private _init = (): void => {
        this._initTimer = undefined;

        this._mainWindow.document.body.addEventListener('mousedown', this._onMouseDown, true); // Capture!
        this._mainWindow.addEventListener('keydown', this._onKeyDown, true); // Capture!

        this._ah.focusedElement.subscribe(this._onElementFocused);
    }

    protected dispose(): void {
        super.dispose();

        if (this._initTimer) {
            this._mainWindow.clearTimeout(this._initTimer);
            this._initTimer = undefined;
        }

        if (this._dismissTimer) {
            this._mainWindow.clearTimeout(this._dismissTimer);
            this._dismissTimer = undefined;
        }

        this._mainWindow.document.body.removeEventListener('mousedown', this._onMouseDown, true);
        this._mainWindow.removeEventListener('keydown', this._onKeyDown, true);

        this._ah.focusedElement.unsubscribe(this._onElementFocused);
    }

    isNavigatingWithKeyboard(): boolean {
        return this.getVal() || false;
    }

    private _onMouseDown = (e: MouseEvent): void => {
        if ((e.buttons === 0) ||
            ((e.clientX === 0) && (e.clientY === 0) &&
             (e.screenX === 0) && (e.screenY === 0))) {
            // This is most likely an event triggered by the screen reader to perform
            // an action on an element, do not dismiss the keyboard navigation mode.
            return;
        }

        this._isMouseUsed = true;

        this.setVal(false, undefined);
    }

    private _onKeyDown = (e: KeyboardEvent): void => {
        const isNavigatingWithKeyboard = this.isNavigatingWithKeyboard();

        if (!isNavigatingWithKeyboard && (e.keyCode === Keys.Tab)) {
            this.setVal(true, undefined);
        } else if (isNavigatingWithKeyboard && (e.keyCode === Keys.Esc)) {
            this._scheduleDismiss();
        }
    }

    private _onElementFocused = (e: HTMLElement | undefined, d: Types.FocusedElementDetails): void => {
        if (!e) {
            return;
        }

        if (this._isMouseUsed) {
            this._isMouseUsed = false;

            return;
        }

        if (this.isNavigatingWithKeyboard()) {
            return;
        }

        if (!d.relatedTarget) {
            return;
        }

        if (d.isFocusedProgrammatically || (d.isFocusedProgrammatically === undefined)) {
            // The element is focused programmatically, or the programmatic focus detection
            // is not working.
            return;
        }

        this.setVal(true, undefined);
    }

    private _scheduleDismiss(): void {
        if (this._dismissTimer) {
            this._mainWindow.clearTimeout(this._dismissTimer);
            this._dismissTimer = undefined;
        }

        const was = this._ah.focusedElement.getFocusedElement();

        this._dismissTimer = this._mainWindow.setTimeout(() => {
            this._dismissTimer = undefined;

            const cur = this._ah.focusedElement.getFocusedElement();

            if (was && cur && (was === cur)) {
                // Esc was pressed, currently focused element hasn't changed.
                // Just dismiss the keyboard navigation mode.
                this.setVal(false, undefined);
            }
        }, _dismissTimeout);
    }

    static setVal(instance: Types.KeyboardNavigationState, val: boolean): void {
        (instance as KeyboardNavigationState).setVal(val, undefined);
    }
}
