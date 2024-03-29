import { FileMode as LoveFileMode } from 'love.filesystem';

import { Machine } from "core/machine";
import { MachineModule } from "core/machine-module";
import { proxy } from "core/object-proxy";
import { assertOption, validateParameters } from "core/utilities";

import FileStream from "./file-stream";

const lf = love.filesystem;

// TODO: Review the 'storage' module:
// 1. Check if it's logic is right.
// 2. Check if it's typing is right.
// 3. Check if it's design can be improved.

/**
 * Resolve any '.' and '..' in a path.
 * Ensures the resulting path is relative to the root.
 * And formats it in unix style.
 */
function resolve(path: string): string {
    const segments: string[] = [];

    for (const [segment] of string.gmatch(path, '[^/\\]+')) {
        if (segment === '..') segments.pop();
        else if (segment !== '.') segments.push(segment);
    }

    return segments.join('/');
}

/**
 * Check that the path is clean from any forbidden characters.
 * Which are: `<>:"|?*` and ASCII control characters (0-31).
 * 
 *  - `"\/"` are not matched because they are valid in paths but not in filenames.
 */
function isClean(path: string): boolean {
    return !string.find(path, '[<>:"|%?%*]')[0];
}

/**
 * Check that the path is clean from illegal characters and resolve it.
 */
function assertAndResolvePath(path: string): string {
    if (!isClean(path)) error('Illegal characters in path', 3);
    return resolve(path);
}

/**
 * @param path make sure it ends with a slash '/'.
 */
function getDirectorySizeRecursively(path: string): number {
    let totalSize = 0;

    for (const [, item] of pairs(lf.getDirectoryItems(path))) {
        const itemPath = `${path}${item}`;
        const itemInfo = assert(lf.getInfo(itemPath));
        const itemSize = itemInfo.type === 'directory'
            ? getDirectorySizeRecursively(`${itemPath}/`)
            : itemInfo.size ?? 0;

        totalSize += itemSize;
    }

    return totalSize;
}

export interface StorageOptions {
    capacity: number,
    basePath: string,
}

export type FileMode = 'r' | 'w' | 'a' | 'r+' | 'w+' | 'a+';

const validFileModes = 'r,w,a,r+,w+,a+'.split(',');

export interface FileInfo {
    type: 'file' | 'directory' | 'other',
    /**
     * The size in bytes of the file, or `undefined` if it can't be determined.
     */
    size?: number,
    /**
     * The file's last modification time in seconds since the unix epoch, or `undefined` if it can't be determined.
     */
    modtime?: number,
}

export default class Storage extends MachineModule {
    readonly totalSpace: number;
    usedSpace = 0;

    protected basePath: string;

    constructor(machine: Machine, options: StorageOptions) {
        super(machine, options);

        this.totalSpace = assertOption(options.capacity, 'capacity', 'number');
        try {
            this.basePath = assertAndResolvePath(assertOption(options.basePath, 'basePath', 'string')) + '/';
        } catch (err: unknown) {
            error(tostring(err));
        }

        this.createBasePathIfNotExists();
        this.refreshSpaceUsage();
    }

    createAPI(): StandardModules.StorageAPI {
        return {
            getTotalSpace: () => {
                return this.totalSpace;
            },

            getUsedSpace: () => {
                return this.usedSpace;
            },

            getAvailableSpace: () => {
                return this.totalSpace - this.usedSpace;
            },

            open: (path: string, mode: FileMode = 'r') => {
                validateParameters();
                if (!validFileModes.includes(mode)) error(`invalid mode ${mode}`, 2);

                path = `${this.basePath}${assertAndResolvePath(path)}`;

                const file = lf.newFile(path);

                try {
                    assert(file.open(mode[0] as LoveFileMode));
                    const fileStream = new FileStream(this, file, mode);
                    return proxy(fileStream);
                } catch (message) {
                    error(string.gsub(tostring(message), `^${this.basePath}`, '')[0], 2);
                }
            },

            getInfo: (path: string) => {
                validateParameters();
                path = `${this.basePath}${assertAndResolvePath(path)}`;

                try {
                    const info = assert(lf.getInfo(path));
                    if (info.type !== 'file' && info.type !== 'directory') info.type = 'other';
                    return info;

                } catch (message: unknown) {
                    error(string.gsub(tostring(message), `^${this.basePath}`, '')[0], 2);
                }
            },

            removeFile: (path: string) => {
                validateParameters();
                path = `${this.basePath}${assertAndResolvePath(path)}`;

                const info = lf.getInfo(path, 'file');
                if (!info) error(`${path.substring(this.basePath.length + 1)} is not a file or doesn't exist`, 2);

                this.usedSpace -= info.size ?? 0;
                try {
                    assert(lf.remove(path));
                } catch (message: unknown) {
                    this.refreshSpaceUsage();
                    error(string.gsub(tostring(message), `^${this.basePath}`, '')[0], 2);
                }
            },

            createDirectory: (path: string) => {
                validateParameters();
                path = `${this.basePath}${assertAndResolvePath(path)}`;

                const info = lf.getInfo(path);
                if (info) error(`${path.substring(this.basePath.length + 1)} already exists`, 2);

                try {
                    assert(lf.createDirectory(path));
                } catch (message: unknown) {
                    error(string.gsub(tostring(message), `^${this.basePath}`, '')[0]);
                }
            },

            removeDirectory: (path: string) => {
                validateParameters();
                path = `${this.basePath}${assertAndResolvePath(path)}`;

                if (!lf.getInfo(path, 'directory')) error(`${path.substring(this.basePath.length + 1)} is not a file or doesn't exist`, 2);
                if (lf.getDirectoryItems(path).length !== 0) error('directory is not empty', 2);

                if (path !== this.basePath && lf.remove(path)) return;
                else return error('failed to remove directory', 2);
            },

            readDirectory: (path: string) => {
                validateParameters();
                path = `${this.basePath}${assertAndResolvePath(path)}`;

                if (!lf.getInfo(path, 'directory')) error(`${path.substring(this.basePath.length + 1)} is not a directory or doesn't exist`, 2);
                try {
                    return lf.getDirectoryItems(path);
                } catch (message: unknown) {
                    error(string.gsub(tostring(message), `^${this.basePath}`, '')[0], 2);
                }
            },
        };
    }

    protected refreshSpaceUsage() {
        this.usedSpace = getDirectorySizeRecursively(this.basePath);
    }

    protected createBasePathIfNotExists() {
        let currentPath = '/';

        for (const [segment] of string.gmatch(this.basePath, '[^/\\]+')) {
            const segmentPath = `${currentPath}${segment}`;
            if (!lf.getInfo(segmentPath, 'directory')) assert(lf.createDirectory(segmentPath));
            currentPath = `${segmentPath}/`;
        }
    }
}