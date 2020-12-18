"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloud_assembly_schema_1 = require("@aws-cdk/cloud-assembly-schema");
const mockfs = require("mock-fs");
const lib_1 = require("../lib");
const mock_aws_1 = require("./mock-aws");
let aws;
beforeEach(() => {
    mockfs({
        '/simple/cdk.out/assets.json': JSON.stringify({
            version: cloud_assembly_schema_1.Manifest.version(),
            files: {
                fileAsset: {
                    type: 'file',
                    source: {
                        path: 'some_file',
                    },
                    destinations: {
                        theDestination: {
                            // Absence of region
                            assumeRoleArn: 'arn:aws:role-${AWS::AccountId}',
                            bucketName: 'some_bucket-${AWS::AccountId}-${AWS::Region}',
                            objectKey: 'some_key-${AWS::AccountId}-${AWS::Region}',
                        },
                    },
                },
            },
            dockerImages: {
                dockerAsset: {
                    type: 'docker-image',
                    source: {
                        directory: 'dockerdir',
                    },
                    destinations: {
                        theDestination: {
                            // Explicit region
                            region: 'explicit_region',
                            assumeRoleArn: 'arn:aws:role-${AWS::AccountId}',
                            repositoryName: 'repo-${AWS::AccountId}-${AWS::Region}',
                            imageTag: 'abcdef',
                        },
                    },
                },
            },
        }),
        '/simple/cdk.out/some_file': 'FILE_CONTENTS',
    });
    aws = mock_aws_1.mockAws();
});
afterEach(() => {
    mockfs.restore();
});
test('check that placeholders are replaced', async () => {
    const pub = new lib_1.AssetPublishing(lib_1.AssetManifest.fromPath('/simple/cdk.out'), { aws });
    aws.mockS3.getBucketLocation = mock_aws_1.mockedApiResult({});
    aws.mockS3.listObjectsV2 = mock_aws_1.mockedApiResult({ Contents: [{ Key: 'some_key-current_account-current_region' }] });
    aws.mockEcr.describeImages = mock_aws_1.mockedApiResult({ /* No error == image exists */});
    await pub.publish();
    expect(aws.s3Client).toHaveBeenCalledWith(expect.objectContaining({
        assumeRoleArn: 'arn:aws:role-current_account',
    }));
    expect(aws.ecrClient).toHaveBeenCalledWith(expect.objectContaining({
        region: 'explicit_region',
        assumeRoleArn: 'arn:aws:role-current_account',
    }));
    expect(aws.mockS3.listObjectsV2).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'some_bucket-current_account-current_region',
        Prefix: 'some_key-current_account-current_region',
        MaxKeys: 1,
    }));
    expect(aws.mockEcr.describeImages).toHaveBeenCalledWith(expect.objectContaining({
        imageIds: [{ imageTag: 'abcdef' }],
        repositoryName: 'repo-current_account-explicit_region',
    }));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhY2Vob2xkZXJzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwbGFjZWhvbGRlcnMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDBFQUEwRDtBQUMxRCxrQ0FBa0M7QUFDbEMsZ0NBQXdEO0FBQ3hELHlDQUFzRDtBQUV0RCxJQUFJLEdBQStCLENBQUM7QUFDcEMsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNkLE1BQU0sQ0FBQztRQUNMLDZCQUE2QixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDNUMsT0FBTyxFQUFFLGdDQUFRLENBQUMsT0FBTyxFQUFFO1lBQzNCLEtBQUssRUFBRTtnQkFDTCxTQUFTLEVBQUU7b0JBQ1QsSUFBSSxFQUFFLE1BQU07b0JBQ1osTUFBTSxFQUFFO3dCQUNOLElBQUksRUFBRSxXQUFXO3FCQUNsQjtvQkFDRCxZQUFZLEVBQUU7d0JBQ1osY0FBYyxFQUFFOzRCQUNkLG9CQUFvQjs0QkFDcEIsYUFBYSxFQUFFLGdDQUFnQzs0QkFDL0MsVUFBVSxFQUFFLDhDQUE4Qzs0QkFDMUQsU0FBUyxFQUFFLDJDQUEyQzt5QkFDdkQ7cUJBQ0Y7aUJBQ0Y7YUFDRjtZQUNELFlBQVksRUFBRTtnQkFDWixXQUFXLEVBQUU7b0JBQ1gsSUFBSSxFQUFFLGNBQWM7b0JBQ3BCLE1BQU0sRUFBRTt3QkFDTixTQUFTLEVBQUUsV0FBVztxQkFDdkI7b0JBQ0QsWUFBWSxFQUFFO3dCQUNaLGNBQWMsRUFBRTs0QkFDZCxrQkFBa0I7NEJBQ2xCLE1BQU0sRUFBRSxpQkFBaUI7NEJBQ3pCLGFBQWEsRUFBRSxnQ0FBZ0M7NEJBQy9DLGNBQWMsRUFBRSx1Q0FBdUM7NEJBQ3ZELFFBQVEsRUFBRSxRQUFRO3lCQUNuQjtxQkFDRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQztRQUNGLDJCQUEyQixFQUFFLGVBQWU7S0FDN0MsQ0FBQyxDQUFDO0lBRUgsR0FBRyxHQUFHLGtCQUFPLEVBQUUsQ0FBQztBQUNsQixDQUFDLENBQUMsQ0FBQztBQUVILFNBQVMsQ0FBQyxHQUFHLEVBQUU7SUFDYixNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbkIsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENBQUMsc0NBQXNDLEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDdEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxxQkFBZSxDQUFDLG1CQUFhLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3BGLEdBQUcsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEdBQUcsMEJBQWUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNuRCxHQUFHLENBQUMsTUFBTSxDQUFDLGFBQWEsR0FBRywwQkFBZSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUseUNBQXlDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUMvRyxHQUFHLENBQUMsT0FBTyxDQUFDLGNBQWMsR0FBRywwQkFBZSxDQUFDLEVBQUUsOEJBQThCLENBQUUsQ0FBQyxDQUFDO0lBRWpGLE1BQU0sR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBRXBCLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDO1FBQ2hFLGFBQWEsRUFBRSw4QkFBOEI7S0FDOUMsQ0FBQyxDQUFDLENBQUM7SUFFSixNQUFNLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztRQUNqRSxNQUFNLEVBQUUsaUJBQWlCO1FBQ3pCLGFBQWEsRUFBRSw4QkFBOEI7S0FDOUMsQ0FBQyxDQUFDLENBQUM7SUFFSixNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7UUFDNUUsTUFBTSxFQUFFLDRDQUE0QztRQUNwRCxNQUFNLEVBQUUseUNBQXlDO1FBQ2pELE9BQU8sRUFBRSxDQUFDO0tBQ1gsQ0FBQyxDQUFDLENBQUM7SUFFSixNQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7UUFDOUUsUUFBUSxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLENBQUM7UUFDbEMsY0FBYyxFQUFFLHNDQUFzQztLQUN2RCxDQUFDLENBQUMsQ0FBQztBQUNOLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTWFuaWZlc3QgfSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0ICogYXMgbW9ja2ZzIGZyb20gJ21vY2stZnMnO1xuaW1wb3J0IHsgQXNzZXRNYW5pZmVzdCwgQXNzZXRQdWJsaXNoaW5nIH0gZnJvbSAnLi4vbGliJztcbmltcG9ydCB7IG1vY2tBd3MsIG1vY2tlZEFwaVJlc3VsdCB9IGZyb20gJy4vbW9jay1hd3MnO1xuXG5sZXQgYXdzOiBSZXR1cm5UeXBlPHR5cGVvZiBtb2NrQXdzPjtcbmJlZm9yZUVhY2goKCkgPT4ge1xuICBtb2NrZnMoe1xuICAgICcvc2ltcGxlL2Nkay5vdXQvYXNzZXRzLmpzb24nOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICB2ZXJzaW9uOiBNYW5pZmVzdC52ZXJzaW9uKCksXG4gICAgICBmaWxlczoge1xuICAgICAgICBmaWxlQXNzZXQ6IHtcbiAgICAgICAgICB0eXBlOiAnZmlsZScsXG4gICAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgICBwYXRoOiAnc29tZV9maWxlJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGRlc3RpbmF0aW9uczoge1xuICAgICAgICAgICAgdGhlRGVzdGluYXRpb246IHtcbiAgICAgICAgICAgICAgLy8gQWJzZW5jZSBvZiByZWdpb25cbiAgICAgICAgICAgICAgYXNzdW1lUm9sZUFybjogJ2Fybjphd3M6cm9sZS0ke0FXUzo6QWNjb3VudElkfScsXG4gICAgICAgICAgICAgIGJ1Y2tldE5hbWU6ICdzb21lX2J1Y2tldC0ke0FXUzo6QWNjb3VudElkfS0ke0FXUzo6UmVnaW9ufScsXG4gICAgICAgICAgICAgIG9iamVjdEtleTogJ3NvbWVfa2V5LSR7QVdTOjpBY2NvdW50SWR9LSR7QVdTOjpSZWdpb259JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBkb2NrZXJJbWFnZXM6IHtcbiAgICAgICAgZG9ja2VyQXNzZXQ6IHtcbiAgICAgICAgICB0eXBlOiAnZG9ja2VyLWltYWdlJyxcbiAgICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICAgIGRpcmVjdG9yeTogJ2RvY2tlcmRpcicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBkZXN0aW5hdGlvbnM6IHtcbiAgICAgICAgICAgIHRoZURlc3RpbmF0aW9uOiB7XG4gICAgICAgICAgICAgIC8vIEV4cGxpY2l0IHJlZ2lvblxuICAgICAgICAgICAgICByZWdpb246ICdleHBsaWNpdF9yZWdpb24nLFxuICAgICAgICAgICAgICBhc3N1bWVSb2xlQXJuOiAnYXJuOmF3czpyb2xlLSR7QVdTOjpBY2NvdW50SWR9JyxcbiAgICAgICAgICAgICAgcmVwb3NpdG9yeU5hbWU6ICdyZXBvLSR7QVdTOjpBY2NvdW50SWR9LSR7QVdTOjpSZWdpb259JyxcbiAgICAgICAgICAgICAgaW1hZ2VUYWc6ICdhYmNkZWYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KSxcbiAgICAnL3NpbXBsZS9jZGsub3V0L3NvbWVfZmlsZSc6ICdGSUxFX0NPTlRFTlRTJyxcbiAgfSk7XG5cbiAgYXdzID0gbW9ja0F3cygpO1xufSk7XG5cbmFmdGVyRWFjaCgoKSA9PiB7XG4gIG1vY2tmcy5yZXN0b3JlKCk7XG59KTtcblxudGVzdCgnY2hlY2sgdGhhdCBwbGFjZWhvbGRlcnMgYXJlIHJlcGxhY2VkJywgYXN5bmMgKCkgPT4ge1xuICBjb25zdCBwdWIgPSBuZXcgQXNzZXRQdWJsaXNoaW5nKEFzc2V0TWFuaWZlc3QuZnJvbVBhdGgoJy9zaW1wbGUvY2RrLm91dCcpLCB7IGF3cyB9KTtcbiAgYXdzLm1vY2tTMy5nZXRCdWNrZXRMb2NhdGlvbiA9IG1vY2tlZEFwaVJlc3VsdCh7fSk7XG4gIGF3cy5tb2NrUzMubGlzdE9iamVjdHNWMiA9IG1vY2tlZEFwaVJlc3VsdCh7IENvbnRlbnRzOiBbeyBLZXk6ICdzb21lX2tleS1jdXJyZW50X2FjY291bnQtY3VycmVudF9yZWdpb24nIH1dIH0pO1xuICBhd3MubW9ja0Vjci5kZXNjcmliZUltYWdlcyA9IG1vY2tlZEFwaVJlc3VsdCh7IC8qIE5vIGVycm9yID09IGltYWdlIGV4aXN0cyAqLyB9KTtcblxuICBhd2FpdCBwdWIucHVibGlzaCgpO1xuXG4gIGV4cGVjdChhd3MuczNDbGllbnQpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICBhc3N1bWVSb2xlQXJuOiAnYXJuOmF3czpyb2xlLWN1cnJlbnRfYWNjb3VudCcsXG4gIH0pKTtcblxuICBleHBlY3QoYXdzLmVjckNsaWVudCkudG9IYXZlQmVlbkNhbGxlZFdpdGgoZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgIHJlZ2lvbjogJ2V4cGxpY2l0X3JlZ2lvbicsXG4gICAgYXNzdW1lUm9sZUFybjogJ2Fybjphd3M6cm9sZS1jdXJyZW50X2FjY291bnQnLFxuICB9KSk7XG5cbiAgZXhwZWN0KGF3cy5tb2NrUzMubGlzdE9iamVjdHNWMikudG9IYXZlQmVlbkNhbGxlZFdpdGgoZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgIEJ1Y2tldDogJ3NvbWVfYnVja2V0LWN1cnJlbnRfYWNjb3VudC1jdXJyZW50X3JlZ2lvbicsXG4gICAgUHJlZml4OiAnc29tZV9rZXktY3VycmVudF9hY2NvdW50LWN1cnJlbnRfcmVnaW9uJyxcbiAgICBNYXhLZXlzOiAxLFxuICB9KSk7XG5cbiAgZXhwZWN0KGF3cy5tb2NrRWNyLmRlc2NyaWJlSW1hZ2VzKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgaW1hZ2VJZHM6IFt7IGltYWdlVGFnOiAnYWJjZGVmJyB9XSxcbiAgICByZXBvc2l0b3J5TmFtZTogJ3JlcG8tY3VycmVudF9hY2NvdW50LWV4cGxpY2l0X3JlZ2lvbicsXG4gIH0pKTtcbn0pO1xuIl19