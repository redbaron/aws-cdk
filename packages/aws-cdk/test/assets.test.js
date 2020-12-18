"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assets_1 = require("../lib/assets");
const asset_manifest_builder_1 = require("../lib/util/asset-manifest-builder");
const util_1 = require("./util");
let toolkit;
let assets;
beforeEach(() => {
    toolkit = {
        bucketUrl: 'https://bucket',
        bucketName: 'bucket',
        prepareEcrRepository: jest.fn(),
    };
    assets = new asset_manifest_builder_1.AssetManifestBuilder();
});
describe('file assets', () => {
    test('convert to manifest and parameters', async () => {
        // GIVEN
        const stack = stackWithAssets([
            {
                sourceHash: 'source-hash',
                path: __filename,
                id: 'SomeStackSomeResource4567',
                packaging: 'file',
                s3BucketParameter: 'BucketParameter',
                s3KeyParameter: 'KeyParameter',
                artifactHashParameter: 'ArtifactHashParameter',
            },
        ]);
        // WHEN
        const params = await assets_1.addMetadataAssetsToManifest(stack, assets, toolkit);
        // THEN
        expect(params).toEqual({
            BucketParameter: 'bucket',
            KeyParameter: 'assets/SomeStackSomeResource4567/||source-hash.js',
            ArtifactHashParameter: 'source-hash',
        });
        expect(assets.toManifest('.').entries).toEqual([
            expect.objectContaining({
                destination: {
                    bucketName: 'bucket',
                    objectKey: 'assets/SomeStackSomeResource4567/source-hash.js',
                },
                source: {
                    packaging: 'file',
                    path: __filename,
                },
            }),
        ]);
    });
    test('hash and ID the same => only one path component', async () => {
        // GIVEN
        const stack = stackWithAssets([
            {
                sourceHash: 'source-hash',
                path: __filename,
                id: 'source-hash',
                packaging: 'file',
                s3BucketParameter: 'BucketParameter',
                s3KeyParameter: 'KeyParameter',
                artifactHashParameter: 'ArtifactHashParameter',
            },
        ]);
        // WHEN
        await assets_1.addMetadataAssetsToManifest(stack, assets, toolkit);
        // THEN
        expect(assets.toManifest('.').entries).toEqual([
            expect.objectContaining({
                destination: {
                    bucketName: 'bucket',
                    objectKey: 'assets/source-hash.js',
                },
            }),
        ]);
    });
    test('reuse', async () => {
        // GIVEN
        const stack = stackWithAssets([
            {
                path: __filename,
                id: 'SomeStackSomeResource4567',
                packaging: 'file',
                s3BucketParameter: 'BucketParameter',
                s3KeyParameter: 'KeyParameter',
                artifactHashParameter: 'ArtifactHashParameter',
                sourceHash: 'boom',
            },
        ]);
        // WHEN
        const params = await assets_1.addMetadataAssetsToManifest(stack, assets, toolkit, ['SomeStackSomeResource4567']);
        // THEN
        expect(params).toEqual({});
        expect(assets.toManifest('.').entries).toEqual([]);
    });
});
describe('docker assets', () => {
    test('parameter and no repository name (old)', async () => {
        // GIVEN
        const stack = stackWithAssets([
            {
                id: 'Stack:Construct/ABC123',
                imageNameParameter: 'MyParameter',
                packaging: 'container-image',
                path: '/foo',
                sourceHash: '0123456789abcdef',
            },
        ]);
        mockFn(toolkit.prepareEcrRepository).mockResolvedValue({ repositoryUri: 'docker.uri' });
        // WHEN
        const params = await assets_1.addMetadataAssetsToManifest(stack, assets, toolkit);
        // THEN
        expect(toolkit.prepareEcrRepository).toHaveBeenCalledWith('cdk/stack-construct-abc123');
        expect(params).toEqual({
            MyParameter: 'docker.uri:0123456789abcdef',
        });
        expect(assets.toManifest('.').entries).toEqual([
            expect.objectContaining({
                type: 'docker-image',
                destination: {
                    imageTag: '0123456789abcdef',
                    repositoryName: 'cdk/stack-construct-abc123',
                },
                source: {
                    directory: '/foo',
                },
            }),
        ]);
    });
    test('if parameter is left out then repo and tag are required', async () => {
        // GIVEN
        const stack = stackWithAssets([
            {
                id: 'Stack:Construct/ABC123',
                packaging: 'container-image',
                path: '/foo',
                sourceHash: '0123456789abcdef',
            },
        ]);
        await expect(assets_1.addMetadataAssetsToManifest(stack, assets, toolkit)).rejects.toThrow('Invalid Docker image asset');
    });
    test('no parameter and repo/tag name (new)', async () => {
        // GIVEN
        const stack = stackWithAssets([
            {
                id: 'Stack:Construct/ABC123',
                repositoryName: 'reponame',
                imageTag: '12345',
                packaging: 'container-image',
                path: '/foo',
                sourceHash: '0123456789abcdef',
            },
        ]);
        mockFn(toolkit.prepareEcrRepository).mockResolvedValue({ repositoryUri: 'docker.uri' });
        // WHEN
        const params = await assets_1.addMetadataAssetsToManifest(stack, assets, toolkit);
        // THEN
        expect(toolkit.prepareEcrRepository).toHaveBeenCalledWith('reponame');
        expect(params).toEqual({}); // No parameters!
        expect(assets.toManifest('.').entries).toEqual([
            expect.objectContaining({
                type: 'docker-image',
                destination: {
                    imageTag: '12345',
                    repositoryName: 'reponame',
                },
                source: {
                    directory: '/foo',
                },
            }),
        ]);
    });
    test('reuse', async () => {
        // GIVEN
        const stack = stackWithAssets([
            {
                path: __dirname,
                id: 'SomeStackSomeResource4567',
                packaging: 'container-image',
                imageNameParameter: 'asdf',
                sourceHash: 'source-hash',
            },
        ]);
        // WHEN
        const params = await assets_1.addMetadataAssetsToManifest(stack, assets, toolkit, ['SomeStackSomeResource4567']);
        // THEN
        expect(params).toEqual({});
        expect(assets.toManifest('.').entries).toEqual([]);
    });
});
function stackWithAssets(assetEntries) {
    return util_1.testStack({
        stackName: 'SomeStack',
        assets: assetEntries,
        template: {
            Resources: {
                SomeResource: {
                    Type: 'AWS::Something::Something',
                },
            },
        },
    });
}
function mockFn(fn) {
    if (!jest.isMockFunction(fn)) {
        throw new Error(`Not a mock function: ${fn}`);
    }
    return fn;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXRzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhc3NldHMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBLDBDQUE0RDtBQUM1RCwrRUFBMEU7QUFDMUUsaUNBQW1DO0FBRW5DLElBQUksT0FBNkIsQ0FBQztBQUNsQyxJQUFJLE1BQTRCLENBQUM7QUFDakMsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNkLE9BQU8sR0FBRztRQUNSLFNBQVMsRUFBRSxnQkFBZ0I7UUFDM0IsVUFBVSxFQUFFLFFBQVE7UUFDcEIsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtLQUN6QixDQUFDO0lBQ1QsTUFBTSxHQUFHLElBQUksNkNBQW9CLEVBQUUsQ0FBQztBQUN0QyxDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQyxhQUFhLEVBQUUsR0FBRyxFQUFFO0lBQzNCLElBQUksQ0FBQyxvQ0FBb0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNwRCxRQUFRO1FBQ1IsTUFBTSxLQUFLLEdBQUcsZUFBZSxDQUFDO1lBQzVCO2dCQUNFLFVBQVUsRUFBRSxhQUFhO2dCQUN6QixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsRUFBRSxFQUFFLDJCQUEyQjtnQkFDL0IsU0FBUyxFQUFFLE1BQU07Z0JBQ2pCLGlCQUFpQixFQUFFLGlCQUFpQjtnQkFDcEMsY0FBYyxFQUFFLGNBQWM7Z0JBQzlCLHFCQUFxQixFQUFFLHVCQUF1QjthQUMvQztTQUNGLENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxNQUFNLE1BQU0sR0FBRyxNQUFNLG9DQUEyQixDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFekUsT0FBTztRQUNQLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFDckIsZUFBZSxFQUFFLFFBQVE7WUFDekIsWUFBWSxFQUFFLG1EQUFtRDtZQUNqRSxxQkFBcUIsRUFBRSxhQUFhO1NBQ3JDLENBQUMs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ZixFQUFFLEVBQUUsMkJBQTJCO2dCQUMvQixTQUFTLEVBQUUsaUJBQWlCO2dCQUM1QixrQkFBa0IsRUFBRSxNQUFNO2dCQUMxQixVQUFVLEVBQUUsYUFBYTthQUMxQjtTQUNGLENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxNQUFNLE1BQU0sR0FBRyxNQUFNLG9DQUEyQixDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUFDO1FBRXhHLE9BQU87UUFDUCxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQ3RCLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNyRCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxlQUFlLENBQUMsWUFBa0M7SUFDekQsT0FBTyxnQkFBUyxDQUFDO1FBQ2YsU0FBUyxFQUFFLFdBQVc7UUFDdEIsTUFBTSxFQUFFLFlBQVk7UUFDcEIsUUFBUSxFQUFFO1lBQ1IsU0FBUyxFQUFFO2dCQUNULFlBQVksRUFBRTtvQkFDWixJQUFJLEVBQUUsMkJBQTJCO2lCQUNsQzthQUNGO1NBQ0Y7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsU0FBUyxNQUFNLENBQWtDLEVBQUs7SUFDcEQsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLEVBQUU7UUFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxFQUFFLENBQUMsQ0FBQztLQUMvQztJQUNELE9BQU8sRUFBRSxDQUFDO0FBQ1osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFzc2V0TWV0YWRhdGFFbnRyeSB9IGZyb20gJ0Bhd3MtY2RrL2Nsb3VkLWFzc2VtYmx5LXNjaGVtYSc7XG5pbXBvcnQgeyBUb29sa2l0UmVzb3VyY2VzSW5mbyB9IGZyb20gJy4uL2xpYic7XG5pbXBvcnQgeyBhZGRNZXRhZGF0YUFzc2V0c1RvTWFuaWZlc3QgfSBmcm9tICcuLi9saWIvYXNzZXRzJztcbmltcG9ydCB7IEFzc2V0TWFuaWZlc3RCdWlsZGVyIH0gZnJvbSAnLi4vbGliL3V0aWwvYXNzZXQtbWFuaWZlc3QtYnVpbGRlcic7XG5pbXBvcnQgeyB0ZXN0U3RhY2sgfSBmcm9tICcuL3V0aWwnO1xuXG5sZXQgdG9vbGtpdDogVG9vbGtpdFJlc291cmNlc0luZm87XG5sZXQgYXNzZXRzOiBBc3NldE1hbmlmZXN0QnVpbGRlcjtcbmJlZm9yZUVhY2goKCkgPT4ge1xuICB0b29sa2l0ID0ge1xuICAgIGJ1Y2tldFVybDogJ2h0dHBzOi8vYnVja2V0JyxcbiAgICBidWNrZXROYW1lOiAnYnVja2V0JyxcbiAgICBwcmVwYXJlRWNyUmVwb3NpdG9yeTogamVzdC5mbigpLFxuICB9IGFzIGFueTtcbiAgYXNzZXRzID0gbmV3IEFzc2V0TWFuaWZlc3RCdWlsZGVyKCk7XG59KTtcblxuZGVzY3JpYmUoJ2ZpbGUgYXNzZXRzJywgKCkgPT4ge1xuICB0ZXN0KCdjb252ZXJ0IHRvIG1hbmlmZXN0IGFuZCBwYXJhbWV0ZXJzJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3Qgc3RhY2sgPSBzdGFja1dpdGhBc3NldHMoW1xuICAgICAge1xuICAgICAgICBzb3VyY2VIYXNoOiAnc291cmNlLWhhc2gnLFxuICAgICAgICBwYXRoOiBfX2ZpbGVuYW1lLFxuICAgICAgICBpZDogJ1NvbWVTdGFja1NvbWVSZXNvdXJjZTQ1NjcnLFxuICAgICAgICBwYWNrYWdpbmc6ICdmaWxlJyxcbiAgICAgICAgczNCdWNrZXRQYXJhbWV0ZXI6ICdCdWNrZXRQYXJhbWV0ZXInLFxuICAgICAgICBzM0tleVBhcmFtZXRlcjogJ0tleVBhcmFtZXRlcicsXG4gICAgICAgIGFydGlmYWN0SGFzaFBhcmFtZXRlcjogJ0FydGlmYWN0SGFzaFBhcmFtZXRlcicsXG4gICAgICB9LFxuICAgIF0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IHBhcmFtcyA9IGF3YWl0IGFkZE1ldGFkYXRhQXNzZXRzVG9NYW5pZmVzdChzdGFjaywgYXNzZXRzLCB0b29sa2l0KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QocGFyYW1zKS50b0VxdWFsKHtcbiAgICAgIEJ1Y2tldFBhcmFtZXRlcjogJ2J1Y2tldCcsXG4gICAgICBLZXlQYXJhbWV0ZXI6ICdhc3NldHMvU29tZVN0YWNrU29tZVJlc291cmNlNDU2Ny98fHNvdXJjZS1oYXNoLmpzJyxcbiAgICAgIEFydGlmYWN0SGFzaFBhcmFtZXRlcjogJ3NvdXJjZS1oYXNoJyxcbiAgICB9KTtcblxuICAgIGV4cGVjdChhc3NldHMudG9NYW5pZmVzdCgnLicpLmVudHJpZXMpLnRvRXF1YWwoW1xuICAgICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICBkZXN0aW5hdGlvbjoge1xuICAgICAgICAgIGJ1Y2tldE5hbWU6ICdidWNrZXQnLFxuICAgICAgICAgIG9iamVjdEtleTogJ2Fzc2V0cy9Tb21lU3RhY2tTb21lUmVzb3VyY2U0NTY3L3NvdXJjZS1oYXNoLmpzJyxcbiAgICAgICAgfSxcbiAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgcGFja2FnaW5nOiAnZmlsZScsXG4gICAgICAgICAgcGF0aDogX19maWxlbmFtZSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9KTtcblxuICB0ZXN0KCdoYXNoIGFuZCBJRCB0aGUgc2FtZSA9PiBvbmx5IG9uZSBwYXRoIGNvbXBvbmVudCcsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHN0YWNrID0gc3RhY2tXaXRoQXNzZXRzKFtcbiAgICAgIHtcbiAgICAgICAgc291cmNlSGFzaDogJ3NvdXJjZS1oYXNoJyxcbiAgICAgICAgcGF0aDogX19maWxlbmFtZSxcbiAgICAgICAgaWQ6ICdzb3VyY2UtaGFzaCcsXG4gICAgICAgIHBhY2thZ2luZzogJ2ZpbGUnLFxuICAgICAgICBzM0J1Y2tldFBhcmFtZXRlcjogJ0J1Y2tldFBhcmFtZXRlcicsXG4gICAgICAgIHMzS2V5UGFyYW1ldGVyOiAnS2V5UGFyYW1ldGVyJyxcbiAgICAgICAgYXJ0aWZhY3RIYXNoUGFyYW1ldGVyOiAnQXJ0aWZhY3RIYXNoUGFyYW1ldGVyJyxcbiAgICAgIH0sXG4gICAgXSk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgYWRkTWV0YWRhdGFBc3NldHNUb01hbmlmZXN0KHN0YWNrLCBhc3NldHMsIHRvb2xraXQpO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChhc3NldHMudG9NYW5pZmVzdCgnLicpLmVudHJpZXMpLnRvRXF1YWwoW1xuICAgICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICBkZXN0aW5hdGlvbjoge1xuICAgICAgICAgIGJ1Y2tldE5hbWU6ICdidWNrZXQnLFxuICAgICAgICAgIG9iamVjdEtleTogJ2Fzc2V0cy9zb3VyY2UtaGFzaC5qcycsXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICBdKTtcbiAgfSk7XG5cbiAgdGVzdCgncmV1c2UnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBzdGFjayA9IHN0YWNrV2l0aEFzc2V0cyhbXG4gICAgICB7XG4gICAgICAgIHBhdGg6IF9fZmlsZW5hbWUsXG4gICAgICAgIGlkOiAnU29tZVN0YWNrU29tZVJlc291cmNlNDU2NycsXG4gICAgICAgIHBhY2thZ2luZzogJ2ZpbGUnLFxuICAgICAgICBzM0J1Y2tldFBhcmFtZXRlcjogJ0J1Y2tldFBhcmFtZXRlcicsXG4gICAgICAgIHMzS2V5UGFyYW1ldGVyOiAnS2V5UGFyYW1ldGVyJyxcbiAgICAgICAgYXJ0aWZhY3RIYXNoUGFyYW1ldGVyOiAnQXJ0aWZhY3RIYXNoUGFyYW1ldGVyJyxcbiAgICAgICAgc291cmNlSGFzaDogJ2Jvb20nLFxuICAgICAgfSxcbiAgICBdKTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCBhZGRNZXRhZGF0YUFzc2V0c1RvTWFuaWZlc3Qoc3RhY2ssIGFzc2V0cywgdG9vbGtpdCwgWydTb21lU3RhY2tTb21lUmVzb3VyY2U0NTY3J10pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChwYXJhbXMpLnRvRXF1YWwoe1xuICAgIH0pO1xuXG4gICAgZXhwZWN0KGFzc2V0cy50b01hbmlmZXN0KCcuJykuZW50cmllcykudG9FcXVhbChbXSk7XG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlKCdkb2NrZXIgYXNzZXRzJywgKCkgPT4ge1xuICB0ZXN0KCdwYXJhbWV0ZXIgYW5kIG5vIHJlcG9zaXRvcnkgbmFtZSAob2xkKScsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHN0YWNrID0gc3RhY2tXaXRoQXNzZXRzKFtcbiAgICAgIHtcbiAgICAgICAgaWQ6ICdTdGFjazpDb25zdHJ1Y3QvQUJDMTIzJyxcbiAgICAgICAgaW1hZ2VOYW1lUGFyYW1ldGVyOiAnTXlQYXJhbWV0ZXInLFxuICAgICAgICBwYWNrYWdpbmc6ICdjb250YWluZXItaW1hZ2UnLFxuICAgICAgICBwYXRoOiAnL2ZvbycsXG4gICAgICAgIHNvdXJjZUhhc2g6ICcwMTIzNDU2Nzg5YWJjZGVmJyxcbiAgICAgIH0sXG4gICAgXSk7XG4gICAgbW9ja0ZuKHRvb2xraXQucHJlcGFyZUVjclJlcG9zaXRvcnkpLm1vY2tSZXNvbHZlZFZhbHVlKHsgcmVwb3NpdG9yeVVyaTogJ2RvY2tlci51cmknIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IHBhcmFtcyA9IGF3YWl0IGFkZE1ldGFkYXRhQXNzZXRzVG9NYW5pZmVzdChzdGFjaywgYXNzZXRzLCB0b29sa2l0KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QodG9vbGtpdC5wcmVwYXJlRWNyUmVwb3NpdG9yeSkudG9IYXZlQmVlbkNhbGxlZFdpdGgoJ2Nkay9zdGFjay1jb25zdHJ1Y3QtYWJjMTIzJyk7XG4gICAgZXhwZWN0KHBhcmFtcykudG9FcXVhbCh7XG4gICAgICBNeVBhcmFtZXRlcjogJ2RvY2tlci51cmk6MDEyMzQ1Njc4OWFiY2RlZicsXG4gICAgfSk7XG4gICAgZXhwZWN0KGFzc2V0cy50b01hbmlmZXN0KCcuJykuZW50cmllcykudG9FcXVhbChbXG4gICAgICBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgIHR5cGU6ICdkb2NrZXItaW1hZ2UnLFxuICAgICAgICBkZXN0aW5hdGlvbjoge1xuICAgICAgICAgIGltYWdlVGFnOiAnMDEyMzQ1Njc4OWFiY2RlZicsXG4gICAgICAgICAgcmVwb3NpdG9yeU5hbWU6ICdjZGsvc3RhY2stY29uc3RydWN0LWFiYzEyMycsXG4gICAgICAgIH0sXG4gICAgICAgIHNvdXJjZToge1xuICAgICAgICAgIGRpcmVjdG9yeTogJy9mb28nLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgXSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2lmIHBhcmFtZXRlciBpcyBsZWZ0IG91dCB0aGVuIHJlcG8gYW5kIHRhZyBhcmUgcmVxdWlyZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBzdGFjayA9IHN0YWNrV2l0aEFzc2V0cyhbXG4gICAgICB7XG4gICAgICAgIGlkOiAnU3RhY2s6Q29uc3RydWN0L0FCQzEyMycsXG4gICAgICAgIHBhY2thZ2luZzogJ2NvbnRhaW5lci1pbWFnZScsXG4gICAgICAgIHBhdGg6ICcvZm9vJyxcbiAgICAgICAgc291cmNlSGFzaDogJzAxMjM0NTY3ODlhYmNkZWYnLFxuICAgICAgfSxcbiAgICBdKTtcblxuICAgIGF3YWl0IGV4cGVjdChhZGRNZXRhZGF0YUFzc2V0c1RvTWFuaWZlc3Qoc3RhY2ssIGFzc2V0cywgdG9vbGtpdCkpLnJlamVjdHMudG9UaHJvdygnSW52YWxpZCBEb2NrZXIgaW1hZ2UgYXNzZXQnKTtcbiAgfSk7XG5cbiAgdGVzdCgnbm8gcGFyYW1ldGVyIGFuZCByZXBvL3RhZyBuYW1lIChuZXcpJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3Qgc3RhY2sgPSBzdGFja1dpdGhBc3NldHMoW1xuICAgICAge1xuICAgICAgICBpZDogJ1N0YWNrOkNvbnN0cnVjdC9BQkMxMjMnLFxuICAgICAgICByZXBvc2l0b3J5TmFtZTogJ3JlcG9uYW1lJyxcbiAgICAgICAgaW1hZ2VUYWc6ICcxMjM0NScsXG4gICAgICAgIHBhY2thZ2luZzogJ2NvbnRhaW5lci1pbWFnZScsXG4gICAgICAgIHBhdGg6ICcvZm9vJyxcbiAgICAgICAgc291cmNlSGFzaDogJzAxMjM0NTY3ODlhYmNkZWYnLFxuICAgICAgfSxcbiAgICBdKTtcbiAgICBtb2NrRm4odG9vbGtpdC5wcmVwYXJlRWNyUmVwb3NpdG9yeSkubW9ja1Jlc29sdmVkVmFsdWUoeyByZXBvc2l0b3J5VXJpOiAnZG9ja2VyLnVyaScgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgcGFyYW1zID0gYXdhaXQgYWRkTWV0YWRhdGFBc3NldHNUb01hbmlmZXN0KHN0YWNrLCBhc3NldHMsIHRvb2xraXQpO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdCh0b29sa2l0LnByZXBhcmVFY3JSZXBvc2l0b3J5KS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgncmVwb25hbWUnKTtcbiAgICBleHBlY3QocGFyYW1zKS50b0VxdWFsKHt9KTsgLy8gTm8gcGFyYW1ldGVycyFcbiAgICBleHBlY3QoYXNzZXRzLnRvTWFuaWZlc3QoJy4nKS5lbnRyaWVzKS50b0VxdWFsKFtcbiAgICAgIGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgdHlwZTogJ2RvY2tlci1pbWFnZScsXG4gICAgICAgIGRlc3RpbmF0aW9uOiB7XG4gICAgICAgICAgaW1hZ2VUYWc6ICcxMjM0NScsXG4gICAgICAgICAgcmVwb3NpdG9yeU5hbWU6ICdyZXBvbmFtZScsXG4gICAgICAgIH0sXG4gICAgICAgIHNvdXJjZToge1xuICAgICAgICAgIGRpcmVjdG9yeTogJy9mb28nLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgXSk7XG4gIH0pO1xuXG4gIHRlc3QoJ3JldXNlJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3Qgc3RhY2sgPSBzdGFja1dpdGhBc3NldHMoW1xuICAgICAge1xuICAgICAgICBwYXRoOiBfX2Rpcm5hbWUsXG4gICAgICAgIGlkOiAnU29tZVN0YWNrU29tZVJlc291cmNlNDU2NycsXG4gICAgICAgIHBhY2thZ2luZzogJ2NvbnRhaW5lci1pbWFnZScsXG4gICAgICAgIGltYWdlTmFtZVBhcmFtZXRlcjogJ2FzZGYnLFxuICAgICAgICBzb3VyY2VIYXNoOiAnc291cmNlLWhhc2gnLFxuICAgICAgfSxcbiAgICBdKTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCBhZGRNZXRhZGF0YUFzc2V0c1RvTWFuaWZlc3Qoc3RhY2ssIGFzc2V0cywgdG9vbGtpdCwgWydTb21lU3RhY2tTb21lUmVzb3VyY2U0NTY3J10pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChwYXJhbXMpLnRvRXF1YWwoe1xuICAgIH0pO1xuXG4gICAgZXhwZWN0KGFzc2V0cy50b01hbmlmZXN0KCcuJykuZW50cmllcykudG9FcXVhbChbXSk7XG4gIH0pO1xufSk7XG5cbmZ1bmN0aW9uIHN0YWNrV2l0aEFzc2V0cyhhc3NldEVudHJpZXM6IEFzc2V0TWV0YWRhdGFFbnRyeVtdKSB7XG4gIHJldHVybiB0ZXN0U3RhY2soe1xuICAgIHN0YWNrTmFtZTogJ1NvbWVTdGFjaycsXG4gICAgYXNzZXRzOiBhc3NldEVudHJpZXMsXG4gICAgdGVtcGxhdGU6IHtcbiAgICAgIFJlc291cmNlczoge1xuICAgICAgICBTb21lUmVzb3VyY2U6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpTb21ldGhpbmc6OlNvbWV0aGluZycsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBtb2NrRm48RiBleHRlbmRzICguLi54czogYW55W10pID0+IGFueT4oZm46IEYpOiBqZXN0Lk1vY2s8UmV0dXJuVHlwZTxGPj4ge1xuICBpZiAoIWplc3QuaXNNb2NrRnVuY3Rpb24oZm4pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBOb3QgYSBtb2NrIGZ1bmN0aW9uOiAke2ZufWApO1xuICB9XG4gIHJldHVybiBmbjtcbn1cbiJdfQ==