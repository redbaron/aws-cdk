/// <reference types="jest" />
import * as AWS from 'aws-sdk';
export declare function mockAws(): {
    mockEcr: AWS.ECR;
    mockS3: AWS.S3;
    discoverPartition: jest.Mock<Promise<string>, []>;
    discoverCurrentAccount: jest.Mock<Promise<{
        accountId: string;
        partition: string;
    }>, []>;
    discoverDefaultRegion: jest.Mock<Promise<string>, []>;
    ecrClient: jest.Mock<Promise<AWS.ECR>, []>;
    s3Client: jest.Mock<Promise<AWS.S3>, []>;
};
export declare function errorWithCode(code: string, message: string): Error;
export declare function mockedApiResult(returnValue: any): jest.Mock<any, any>;
export declare function mockedApiFailure(code: string, message: string): jest.Mock<any, any>;
/**
 * Mock upload, draining the stream that we get before returning
 * so no race conditions happen with the uninstallation of mock-fs.
 */
export declare function mockUpload(expectContent?: string): jest.Mock<any, any>;