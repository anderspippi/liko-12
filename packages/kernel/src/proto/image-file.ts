type ImageData = StandardModules.Graphics.ImageData;

//#region Tokenizer

export interface Token {
    line: number,
    column: number,
    fileName: string,
    content: string,
}

export class TokenError extends Error {
    public readonly line: number;
    public readonly column: number;
    public readonly fileName: string;
    public readonly plainMessage: string;

    constructor({ line, column, fileName }: Token, message: string) {
        super(`${fileName}:${line}:${column}: ${message}`);
        this.name = 'TokenError';

        this.line = line, this.column = column, this.fileName = fileName;
        this.plainMessage = message;
    }
}

export class MissingTokenException extends TokenError {
    constructor(fileName: string, line: number, column: number) {
        super({ fileName, line, column, content: '<INTERNAL>' }, 'Expected a following token terminated with a semicolon (;).');
        this.name = 'MissingTokenException';
    }
}

/**
 * Supports both LF and CRLF.
 */
export class SemicolonTokenizer {
    /**
     * Of the last semicolon found.
     */
    private index = 0;
    /**
     * Of the last semicolon found.
     */
    private line = 1;
    /**
     * Of the last semicolon found.
     */
    private column = 1;

    private reachedEnd = false;

    constructor(
        private fileName: string,
        private rawData: string,
    ) { }

    /**
     * Get a next token optionally. Get `null` if there are no more tokens available.
     */
    next(): Token | null
    /**
     * Get a specific count of tokens explicity.
     * @throws `MissingTokenException` if there are not enough tokens available.
     */
    next(count: number): Token[]
    next(count?: number): Token[] | Token | null {
        return (count === undefined) ? this.nextToken() : this.nextTokens(count);
    }

    private nextToken(): Token | null {
        if (this.reachedEnd) return null;

        const previousIndex = this.index;
        this.index = this.rawData.indexOf(';', previousIndex) + 1;

        if (this.index === 0) {
            this.destroy();
            return null; // Reached end of stream.
        }

        const token: Token = {
            line: this.line,
            column: this.column,
            fileName: this.fileName,
            content: this.rawData.substring(previousIndex, this.index - 1),
        };

        this.updateLastSemicolonLocation(token);
        return token;
    }

    /**
     * @throws `MissingTokenException`.
     */
    private nextTokens(count: number): Token[] {
        const tokens: Token[] = [];

        while (count > 0) {
            const token = this.nextToken();
            if (token === null) throw new MissingTokenException(this.fileName, this.line, this.column);
            tokens.push(token);
            count--;
        }

        return tokens;
    }

    private updateLastSemicolonLocation({ content }: Token) {
        let lastIndex = 0;

        while (true) {
            const index = content.indexOf('\n', lastIndex);
            if (index === -1) break;

            lastIndex = index + 1;
            this.line++;
            this.column = 1;
        }

        this.column += content.length - lastIndex + 1;
    }

    private destroy() {
        // Clear the 'rawData' field so it can free some memory.
        this.rawData = '';

        this.reachedEnd = true;
    }
}

//#endregion

//#region Exceptions

/**
 * Thrown when a `.lk12` file is rejected because it's in legacy format.
 */
export class LegacyFileException extends Error {
    constructor(public readonly fileName: string) {
        super(`${fileName}: Legacy .lk12 files are currently unsupported.`); // TODO: Support legacy .lk12 files more properly.
        this.name = 'LegacyFileException';
    }
}

/**
 * Thrown when the given file doesn't start with "LIKO-12;".
 */
export class InvalidMagicTagException extends Error {
    constructor(public readonly fileName: string) {
        super(`${fileName}: This is not a standard .lk12 file.`);
        this.name = 'InvalidMagicTagException';
    }
}

export class InvalidTokenException extends TokenError {
    constructor(token: Token, message: string) {
        super(token, message);
        this.name = 'InvalidTokenException';
    }
}

/**
 * Thrown when the give file doesn't contain the requested content type.
 */
export class UnMatchingFileTypeException extends InvalidTokenException {
    constructor(
        token: Token,
        public readonly detectedType: string,
        public readonly expectedType: string,
    ) {
        super(token, `Expected '${expectedType}' content type (found '${detectedType.toLowerCase()}' instead).`);
        this.name = 'UnMatchingFileTypeException';
    }
}

export class UnsupportedVersionException extends InvalidTokenException {
    constructor(token: Token) {
        super(token, `Unsupported file version '${token.content}'.`);
        this.name = 'UnsupportedVersionException';
    }
}

//#endregion

type SupportedTypes = {
    'image': ImageData,
    'palette': [r: number, g: number, b: number][],
}

export function loadFile<T extends keyof SupportedTypes>(fileName: string, rawData: string, fileType: T): SupportedTypes[T];
export function loadFile(fileName: string, rawData: string): SupportedTypes[keyof SupportedTypes]
export function loadFile(fileName: string, rawData: string, fileType?: keyof SupportedTypes): SupportedTypes[keyof SupportedTypes] {
    if (rawData.substring(0, 5) === 'LK12;') throw new LegacyFileException(fileName);

    if (!rawData.startsWith("LIKO-12;")) throw new InvalidMagicTagException(fileName);

    const tokenizer = new SemicolonTokenizer(fileName, rawData);
    if (tokenizer.next(1)[0].content !== 'LIKO-12') throw new InvalidMagicTagException(fileName);

    const [fileTypeToken, versionToken] = tokenizer.next(2);
    const rawFileType = fileTypeToken.content;

    if (!string.match(rawFileType, '^[A-Z_]+$')[0]) throw new InvalidTokenException(fileTypeToken,
        `File type ('${fileTypeToken.content}') should only contain (A-Z) characters and the underscore (_) character.`);

    const isBinary = rawFileType.endsWith('_BIN');
    const detectedFileType = isBinary ? rawFileType.substring(0, rawFileType.length - 4) : rawFileType;

    if (fileType !== undefined && fileType.toUpperCase() !== detectedFileType)
        throw new UnMatchingFileTypeException(fileTypeToken, detectedFileType, fileType);

    if (versionToken.content !== 'V1') throw new UnsupportedVersionException(versionToken);

    if (detectedFileType === 'IMAGE') {
        if (!isBinary) {
            const [resolutionToken, colorModeToken, pixelDataToken] = tokenizer.next(3);
        }
    }

    throw "unimplemented"; // FIXME: Implement this.
}

