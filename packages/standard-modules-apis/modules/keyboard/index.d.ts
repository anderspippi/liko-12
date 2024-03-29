/// <reference path="./keys.d.ts" />
/// <reference path="./scancodes.d.ts" />

declare namespace StandardModules {
    export interface KeyboardAPI {
        /**
         * Enable or disable text input events.
         * It is enabled by default on Windows, Mac, and Linux, and disabled by default on iOS and Android.
         * 
         * It would also show the on-screen keyboard for touch devices.
         */
        setTextInput(this: void, enable: boolean): void;

        /**
         * Get whether text input events are enabled.
         */
        hasTextInput(this: void): boolean;

        /**
         * Get the hardware scancode corresponding to the given key.
         * @returns `"unknown"` if the given key has no known physical representation on the current system.
         */
        getScancodeFromKey(this: void, key: Keyboard.KeyConstant): Keyboard.Scancode;

        /**
         * Get the key corresponding to the given hardware scancode.
         * @returns `"unknown"` if the scancode doesn't map to a KeyConstant on the current system.
         */
        getKeyFromScancode(this: void, scancode: Keyboard.Scancode): Keyboard.KeyConstant;

        /**
         * Checks whether one at least of the provided keys is down (this: void, pressed).
         */
        isDown(this: void, ...keys: Keyboard.KeyConstant[]): boolean;

        /**
         * Checks whether one at least of the provided scancodes is down (this: void, pressed).
         */
        isScancodeDown(this: void, ...scancodes: Keyboard.Scancode[]): boolean;
    }
}