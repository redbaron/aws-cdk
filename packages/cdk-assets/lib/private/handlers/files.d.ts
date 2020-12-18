import { FileManifestEntry } from '../../asset-manifest';
import { IAssetHandler, IHandlerHost } from '../asset-handler';
export declare class FileAssetHandler implements IAssetHandler {
    private readonly workDir;
    private readonly asset;
    private readonly host;
    private readonly fileCacheRoot;
    constructor(workDir: string, asset: FileManifestEntry, host: IHandlerHost);
    publish(): Promise<void>;
    private packageFile;
}
