import { RemoteOptions } from 'modules/remote';
import { ScreenOptions } from 'modules/screen';
import { StorageOptions } from 'modules/storage';
import * as rawOptions from 'options.json';

type KnownModules = 'events' | 'timer' | 'storage' | 'screen' | 'graphics' | 'keyboard';

interface Options {
    window: {
        title: string,
        icon?: string | null,
        width: number,
        height: number,
        resizable: boolean,
        minWidth: number,
        minHeight: number,
        vsync: number,
        x?: number | null,
        y?: number | null,
        borderless: boolean,
        fullscreen: boolean,
        fullscreenType: string,
    },
    modules: (KnownModules | string)[],
    globals: (KnownModules | string)[],
    options: {
        screen?: ScreenOptions,
        storage?: StorageOptions,
        remote?: RemoteOptions,

        [key: string]: Record<string, any> | undefined,
    }
}

export const options: Options = rawOptions;
