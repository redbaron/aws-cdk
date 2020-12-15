"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockDeployStack = jest.fn();
jest.mock('../../lib/api/deploy-stack', () => ({
    deployStack: mockDeployStack,
}));
let mockTheToolkitInfo;
const api_1 = require("../../lib/api");
const mock_sdk_1 = require("../util/mock-sdk");
let bootstrapper;
beforeEach(() => {
    api_1.ToolkitStackInfo.lookup = jest.fn().mockImplementation(() => Promise.resolve(mockTheToolkitInfo));
    bootstrapper = new api_1.Bootstrapper({ source: 'default' });
});
describe('Bootstrapping v2', () => {
    const env = {
        account: '123456789012',
        region: 'us-east-1',
        name: 'mock',
    };
    let sdk;
    beforeEach(() => {
        sdk = new mock_sdk_1.MockSdkProvider({ realSdk: false });
        mockTheToolkitInfo = undefined;
    });
    afterEach(() => {
        mockDeployStack.mockClear();
    });
    test('passes the bucket name as a CFN parameter', async () => {
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                bucketName: 'my-bucket-name',
                cloudFormationExecutionPolicies: ['arn:policy'],
            },
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                FileAssetsBucketName: 'my-bucket-name',
                PublicAccessBlockConfiguration: 'true',
            }),
        }));
    });
    test('passes the KMS key ID as a CFN parameter', async () => {
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                cloudFormationExecutionPolicies: ['arn:policy'],
                kmsKeyId: 'my-kms-key-id',
            },
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                FileAssetsBucketKmsKeyId: 'my-kms-key-id',
                PublicAccessBlockConfiguration: 'true',
            }),
        }));
    });
    test('passes false to PublicAccessBlockConfiguration', async () => {
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                cloudFormationExecutionPolicies: ['arn:policy'],
                publicAccessBlockConfiguration: false,
            },
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                PublicAccessBlockConfiguration: 'false',
            }),
        }));
    });
    test('passing trusted accounts without CFN managed policies results in an error', async () => {
        await expect(bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                trustedAccounts: ['123456789012'],
            },
        }))
            .rejects
            .toThrow(/--cloudformation-execution-policies/);
    });
    test('passing trusted accounts without CFN managed policies on the existing stack results in an error', async () => {
        mockTheToolkitInfo = {
            parameters: {
                CloudFormationExecutionPolicies: '',
            },
        };
        await expect(bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                trustedAccounts: ['123456789012'],
            },
        }))
            .rejects
            .toThrow(/--cloudformation-execution-policies/);
    });
    test('passing no CFN managed policies without trusted accounts is okay', async () => {
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {},
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                CloudFormationExecutionPolicies: '',
            }),
        }));
    });
    test('allow adding trusted account if there was already a policy on the stack', async () => {
        // GIVEN
        mockTheToolkitInfo = {
            parameters: {
                CloudFormationExecutionPolicies: 'arn:aws:something',
            },
        };
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                trustedAccounts: ['123456789012'],
            },
        });
        // Did not throw
    });
    test('Do not allow downgrading bootstrap stack version', async () => {
        // GIVEN
        mockTheToolkitInfo = {
            version: 999,
        };
        await expect(bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                cloudFormationExecutionPolicies: ['arn:policy'],
            },
        }))
            .rejects.toThrow('Not downgrading existing bootstrap stack');
    });
    test('bootstrap template has the right exports', async () => {
        var _a;
        let template;
        mockDeployStack.mockImplementation((args) => {
            template = args.stack.template;
        });
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                cloudFormationExecutionPolicies: ['arn:policy'],
            },
        });
        const exports = Object.values((_a = template.Outputs) !== null && _a !== void 0 ? _a : {})
            .filter((o) => o.Export !== undefined)
            .map((o) => o.Export.Name);
        expect(exports).toEqual([
            // This used to be used by aws-s3-assets
            { 'Fn::Sub': 'CdkBootstrap-${Qualifier}-FileAssetKeyArn' },
        ]);
    });
    describe('termination protection', () => {
        test('stack is not termination protected by default', async () => {
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                parameters: {
                    cloudFormationExecutionPolicies: ['arn:policy'],
                },
            });
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                stack: expect.objectContaining({
                    terminationProtection: false,
                }),
            }));
        });
        test('stack is termination protected when option is set', async () => {
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                terminationProtection: true,
                parameters: {
                    cloudFormationExecutionPolicies: ['arn:policy'],
                },
            });
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                stack: expect.objectContaining({
                    terminationProtection: true,
                }),
            }));
        });
        test('termination protection is left alone when option is not given', async () => {
            mockTheToolkitInfo = mock_sdk_1.mockToolkitStackInfo({
                EnableTerminationProtection: true,
            });
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                parameters: {
                    cloudFormationExecutionPolicies: ['arn:policy'],
                },
            });
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                stack: expect.objectContaining({
                    terminationProtection: true,
                }),
            }));
        });
        test('termination protection can be switched off', async () => {
            mockTheToolkitInfo = mock_sdk_1.mockToolkitStackInfo({
                EnableTerminationProtection: true,
            });
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                terminationProtection: false,
                parameters: {
                    cloudFormationExecutionPolicies: ['arn:policy'],
                },
            });
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                stack: expect.objectContaining({
                    terminationProtection: false,
                }),
            }));
        });
    });
    describe('KMS key', () => {
        test.each([
            // Default case
            [undefined, 'AWS_MANAGED_KEY'],
            // Create a new key
            [true, ''],
            // Don't create a new key
            [false, 'AWS_MANAGED_KEY'],
        ])('(new stack) createCustomerMasterKey=%p => parameter becomes %p ', async (createCustomerMasterKey, paramKeyId) => {
            // GIVEN: no existing stack
            // WHEN
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                parameters: {
                    createCustomerMasterKey,
                    cloudFormationExecutionPolicies: ['arn:booh'],
                },
            });
            // THEN
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                parameters: expect.objectContaining({
                    FileAssetsBucketKmsKeyId: paramKeyId,
                }),
            }));
        });
        test.each([
            // Old bootstrap stack being upgraded to new one
            [undefined, undefined, 'AWS_MANAGED_KEY'],
            // There is a value, user doesn't request a change
            ['arn:aws:key', undefined, undefined],
            // Switch off existing key
            ['arn:aws:key', false, 'AWS_MANAGED_KEY'],
            // Switch on existing key
            ['AWS_MANAGED_KEY', true, ''],
        ])('(upgrading) current param %p, createCustomerMasterKey=%p => parameter becomes %p ', async (currentKeyId, createCustomerMasterKey, paramKeyId) => {
            // GIVEN
            mockTheToolkitInfo = mock_sdk_1.mockToolkitStackInfo({
                Parameters: currentKeyId ? [{ ParameterKey: 'FileAssetsBucketKmsKeyId', ParameterValue: currentKeyId }] : undefined,
            });
            // WHEN
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                parameters: {
                    createCustomerMasterKey,
                    cloudFormationExecutionPolicies: ['arn:booh'],
                },
            });
            // THEN
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                parameters: expect.objectContaining({
                    FileAssetsBucketKmsKeyId: paramKeyId,
                }),
            }));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdHN0cmFwMi50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm9vdHN0cmFwMi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO0FBRWxDLElBQUksQ0FBQyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUM3QyxXQUFXLEVBQUUsZUFBZTtDQUM3QixDQUFDLENBQUMsQ0FBQztBQUVKLElBQUksa0JBQXVCLENBQUM7QUFFNUIsdUNBQW1GO0FBQ25GLCtDQUF5RTtBQUV6RSxJQUFJLFlBQTBCLENBQUM7QUFDL0IsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNiLHNCQUF3QixDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7SUFDM0csWUFBWSxHQUFHLElBQUksa0JBQVksQ0FBQyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0FBQ3pELENBQUMsQ0FBQyxDQUFDO0FBRUgsUUFBUSxDQUFDLGtCQUFrQixFQUFFLEdBQUcsRUFBRTtJQUNoQyxNQUFNLEdBQUcsR0FBRztRQUNWLE9BQU8sRUFBRSxjQUFjO1FBQ3ZCLE1BQU0sRUFBRSxXQUFXO1FBQ25CLElBQUksRUFBRSxNQUFNO0tBQ2IsQ0FBQztJQUVGLElBQUksR0FBb0IsQ0FBQztJQUN6QixVQUFVLENBQUMsR0FBRyxFQUFFO1FBQ2QsR0FBRyxHQUFHLElBQUksMEJBQWUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQzlDLGtCQUFrQixHQUFHLFNBQVMsQ0FBQztJQUNqQyxDQUFDLENBQUMsQ0FBQztJQUVILFNBQVMsQ0FBQyxHQUFHLEVBQUU7UUFDYixlQUFlLENBQUMsU0FB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QUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBtb2NrRGVwbG95U3RhY2sgPSBqZXN0LmZuKCk7XG5cbmplc3QubW9jaygnLi4vLi4vbGliL2FwaS9kZXBsb3ktc3RhY2snLCAoKSA9PiAoe1xuICBkZXBsb3lTdGFjazogbW9ja0RlcGxveVN0YWNrLFxufSkpO1xuXG5sZXQgbW9ja1RoZVRvb2xraXRJbmZvOiBhbnk7XG5cbmltcG9ydCB7IEJvb3RzdHJhcHBlciwgRGVwbG95U3RhY2tPcHRpb25zLCBUb29sa2l0U3RhY2tJbmZvIH0gZnJvbSAnLi4vLi4vbGliL2FwaSc7XG5pbXBvcnQgeyBNb2NrU2RrUHJvdmlkZXIsIG1vY2tUb29sa2l0U3RhY2tJbmZvIH0gZnJvbSAnLi4vdXRpbC9tb2NrLXNkayc7XG5cbmxldCBib290c3RyYXBwZXI6IEJvb3RzdHJhcHBlcjtcbmJlZm9yZUVhY2goKCkgPT4ge1xuICAoVG9vbGtpdFN0YWNrSW5mbyBhcyBhbnkpLmxvb2t1cCA9IGplc3QuZm4oKS5tb2NrSW1wbGVtZW50YXRpb24oKCkgPT4gUHJvbWlzZS5yZXNvbHZlKG1vY2tUaGVUb29sa2l0SW5mbykpO1xuICBib290c3RyYXBwZXIgPSBuZXcgQm9vdHN0cmFwcGVyKHsgc291cmNlOiAnZGVmYXVsdCcgfSk7XG59KTtcblxuZGVzY3JpYmUoJ0Jvb3RzdHJhcHBpbmcgdjInLCAoKSA9PiB7XG4gIGNvbnN0IGVudiA9IHtcbiAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgIG5hbWU6ICdtb2NrJyxcbiAgfTtcblxuICBsZXQgc2RrOiBNb2NrU2RrUHJvdmlkZXI7XG4gIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgIHNkayA9IG5ldyBNb2NrU2RrUHJvdmlkZXIoeyByZWFsU2RrOiBmYWxzZSB9KTtcbiAgICBtb2NrVGhlVG9vbGtpdEluZm8gPSB1bmRlZmluZWQ7XG4gIH0pO1xuXG4gIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgbW9ja0RlcGxveVN0YWNrLm1vY2tDbGVhcigpO1xuICB9KTtcblxuICB0ZXN0KCdwYXNzZXMgdGhlIGJ1Y2tldCBuYW1lIGFzIGEgQ0ZOIHBhcmFtZXRlcicsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgYnVja2V0TmFtZTogJ215LWJ1Y2tldC1uYW1lJyxcbiAgICAgICAgY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llczogWydhcm46cG9saWN5J10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgZXhwZWN0KG1vY2tEZXBsb3lTdGFjaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgcGFyYW1ldGVyczogZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICBGaWxlQXNzZXRzQnVja2V0TmFtZTogJ215LWJ1Y2tldC1uYW1lJyxcbiAgICAgICAgUHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uOiAndHJ1ZScsXG4gICAgICB9KSxcbiAgICB9KSk7XG4gIH0pO1xuXG4gIHRlc3QoJ3Bhc3NlcyB0aGUgS01TIGtleSBJRCBhcyBhIENGTiBwYXJhbWV0ZXInLCBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM6IFsnYXJuOnBvbGljeSddLFxuICAgICAgICBrbXNLZXlJZDogJ215LWttcy1rZXktaWQnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGV4cGVjdChtb2NrRGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgIHBhcmFtZXRlcnM6IGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgRmlsZUFzc2V0c0J1Y2tldEttc0tleUlkOiAnbXkta21zLWtleS1pZCcsXG4gICAgICAgIFB1YmxpY0FjY2Vzc0Jsb2NrQ29uZmlndXJhdGlvbjogJ3RydWUnLFxuICAgICAgfSksXG4gICAgfSkpO1xuICB9KTtcblxuICB0ZXN0KCdwYXNzZXMgZmFsc2UgdG8gUHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uJywgYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IGJvb3RzdHJhcHBlci5ib290c3RyYXBFbnZpcm9ubWVudChlbnYsIHNkaywge1xuICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzOiBbJ2Fybjpwb2xpY3knXSxcbiAgICAgICAgcHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBleHBlY3QobW9ja0RlcGxveVN0YWNrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICBwYXJhbWV0ZXJzOiBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgIFB1YmxpY0FjY2Vzc0Jsb2NrQ29uZmlndXJhdGlvbjogJ2ZhbHNlJyxcbiAgICAgIH0pLFxuICAgIH0pKTtcbiAgfSk7XG5cbiAgdGVzdCgncGFzc2luZyB0cnVzdGVkIGFjY291bnRzIHdpdGhvdXQgQ0ZOIG1hbmFnZWQgcG9saWNpZXMgcmVzdWx0cyBpbiBhbiBlcnJvcicsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBleHBlY3QoYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgIHRydXN0ZWRBY2NvdW50czogWycxMjM0NTY3ODkwMTInXSxcbiAgICAgIH0sXG4gICAgfSkpXG4gICAgICAucmVqZWN0c1xuICAgICAgLnRvVGhyb3coLy0tY2xvdWRmb3JtYXRpb24tZXhlY3V0aW9uLXBvbGljaWVzLyk7XG4gIH0pO1xuXG4gIHRlc3QoJ3Bhc3NpbmcgdHJ1c3RlZCBhY2NvdW50cyB3aXRob3V0IENGTiBtYW5hZ2VkIHBvbGljaWVzIG9uIHRoZSBleGlzdGluZyBzdGFjayByZXN1bHRzIGluIGFuIGVycm9yJywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tUaGVUb29sa2l0SW5mbyA9IHtcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgQ2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llczogJycsXG4gICAgICB9LFxuICAgIH07XG5cbiAgICBhd2FpdCBleHBlY3QoYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgIHRydXN0ZWRBY2NvdW50czogWycxMjM0NTY3ODkwMTInXSxcbiAgICAgIH0sXG4gICAgfSkpXG4gICAgICAucmVqZWN0c1xuICAgICAgLnRvVGhyb3coLy0tY2xvdWRmb3JtYXRpb24tZXhlY3V0aW9uLXBvbGljaWVzLyk7XG4gIH0pO1xuXG4gIHRlc3QoJ3Bhc3Npbmcgbm8gQ0ZOIG1hbmFnZWQgcG9saWNpZXMgd2l0aG91dCB0cnVzdGVkIGFjY291bnRzIGlzIG9rYXknLCBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICBwYXJhbWV0ZXJzOiB7fSxcbiAgICB9KTtcblxuICAgIGV4cGVjdChtb2NrRGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgIHBhcmFtZXRlcnM6IGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgQ2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llczogJycsXG4gICAgICB9KSxcbiAgICB9KSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2FsbG93IGFkZGluZyB0cnVzdGVkIGFjY291bnQgaWYgdGhlcmUgd2FzIGFscmVhZHkgYSBwb2xpY3kgb24gdGhlIHN0YWNrJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgbW9ja1RoZVRvb2xraXRJbmZvID0ge1xuICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICBDbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzOiAnYXJuOmF3czpzb21ldGhpbmcnLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgIHRydXN0ZWRBY2NvdW50czogWycxMjM0NTY3ODkwMTInXSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgLy8gRGlkIG5vdCB0aHJvd1xuICB9KTtcblxuICB0ZXN0KCdEbyBub3QgYWxsb3cgZG93bmdyYWRpbmcgYm9vdHN0cmFwIHN0YWNrIHZlcnNpb24nLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrVGhlVG9vbGtpdEluZm8gPSB7XG4gICAgICB2ZXJzaW9uOiA5OTksXG4gICAgfTtcblxuICAgIGF3YWl0IGV4cGVjdChib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llczogWydhcm46cG9saWN5J10sXG4gICAgICB9LFxuICAgIH0pKVxuICAgICAgLnJlamVjdHMudG9UaHJvdygnTm90IGRvd25ncmFkaW5nIGV4aXN0aW5nIGJvb3RzdHJhcCBzdGFjaycpO1xuICB9KTtcblxuICB0ZXN0KCdib290c3RyYXAgdGVtcGxhdGUgaGFzIHRoZSByaWdodCBleHBvcnRzJywgYXN5bmMgKCkgPT4ge1xuICAgIGxldCB0ZW1wbGF0ZTogYW55O1xuICAgIG1vY2tEZXBsb3lTdGFjay5tb2NrSW1wbGVtZW50YXRpb24oKGFyZ3M6IERlcGxveVN0YWNrT3B0aW9ucykgPT4ge1xuICAgICAgdGVtcGxhdGUgPSBhcmdzLnN0YWNrLnRlbXBsYXRlO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM6IFsnYXJuOnBvbGljeSddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGV4cG9ydHMgPSBPYmplY3QudmFsdWVzKHRlbXBsYXRlLk91dHB1dHMgPz8ge30pXG4gICAgICAuZmlsdGVyKChvOiBhbnkpID0+IG8uRXhwb3J0ICE9PSB1bmRlZmluZWQpXG4gICAgICAubWFwKChvOiBhbnkpID0+IG8uRXhwb3J0Lk5hbWUpO1xuXG4gICAgZXhwZWN0KGV4cG9ydHMpLnRvRXF1YWwoW1xuICAgICAgLy8gVGhpcyB1c2VkIHRvIGJlIHVzZWQgYnkgYXdzLXMzLWFzc2V0c1xuICAgICAgeyAnRm46OlN1Yic6ICdDZGtCb290c3RyYXAtJHtRdWFsaWZpZXJ9LUZpbGVBc3NldEtleUFybicgfSxcbiAgICBdKTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3Rlcm1pbmF0aW9uIHByb3RlY3Rpb24nLCAoKSA9PiB7XG4gICAgdGVzdCgnc3RhY2sgaXMgbm90IHRlcm1pbmF0aW9uIHByb3RlY3RlZCBieSBkZWZhdWx0JywgYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzOiBbJ2Fybjpwb2xpY3knXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBleHBlY3QobW9ja0RlcGxveVN0YWNrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgIHN0YWNrOiBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgICAgdGVybWluYXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgfSksXG4gICAgICB9KSk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdzdGFjayBpcyB0ZXJtaW5hdGlvbiBwcm90ZWN0ZWQgd2hlbiBvcHRpb24gaXMgc2V0JywgYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICAgIHRlcm1pbmF0aW9uUHJvdGVjdGlvbjogdHJ1ZSxcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM6IFsnYXJuOnBvbGljeSddLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGV4cGVjdChtb2NrRGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgc3RhY2s6IGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgICB0ZXJtaW5hdGlvblByb3RlY3Rpb246IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgfSkpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgndGVybWluYXRpb24gcHJvdGVjdGlvbiBpcyBsZWZ0IGFsb25lIHdoZW4gb3B0aW9uIGlzIG5vdCBnaXZlbicsIGFzeW5jICgpID0+IHtcbiAgICAgIG1vY2tUaGVUb29sa2l0SW5mbyA9IG1vY2tUb29sa2l0U3RhY2tJbmZvKHtcbiAgICAgICAgRW5hYmxlVGVybWluYXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICAgICAgfSk7XG5cbiAgICAgIGF3YWl0IGJvb3RzdHJhcHBlci5ib290c3RyYXBFbnZpcm9ubWVudChlbnYsIHNkaywge1xuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llczogWydhcm46cG9saWN5J10sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgZXhwZWN0KG1vY2tEZXBsb3lTdGFjaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICBzdGFjazogZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICAgIHRlcm1pbmF0aW9uUHJvdGVjdGlvbjogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICB9KSk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCd0ZXJtaW5hdGlvbiBwcm90ZWN0aW9uIGNhbiBiZSBzd2l0Y2hlZCBvZmYnLCBhc3luYyAoKSA9PiB7XG4gICAgICBtb2NrVGhlVG9vbGtpdEluZm8gPSBtb2NrVG9vbGtpdFN0YWNrSW5mbyh7XG4gICAgICAgIEVuYWJsZVRlcm1pbmF0aW9uUHJvdGVjdGlvbjogdHJ1ZSxcbiAgICAgIH0pO1xuXG4gICAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgICAgdGVybWluYXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM6IFsnYXJuOnBvbGljeSddLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGV4cGVjdChtb2NrRGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgc3RhY2s6IGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgICB0ZXJtaW5hdGlvblByb3RlY3Rpb246IGZhbHNlLFxuICAgICAgICB9KSxcbiAgICAgIH0pKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ0tNUyBrZXknLCAoKSA9PiB7XG4gICAgdGVzdC5lYWNoKFtcbiAgICAgIC8vIERlZmF1bHQgY2FzZVxuICAgICAgW3VuZGVmaW5lZCwgJ0FXU19NQU5BR0VEX0tFWSddLFxuICAgICAgLy8gQ3JlYXRlIGEgbmV3IGtleVxuICAgICAgW3RydWUsICcnXSxcbiAgICAgIC8vIERvbid0IGNyZWF0ZSBhIG5ldyBrZXlcbiAgICAgIFtmYWxzZSwgJ0FXU19NQU5BR0VEX0tFWSddLFxuICAgIF0pKCcobmV3IHN0YWNrKSBjcmVhdGVDdXN0b21lck1hc3RlcktleT0lcCA9PiBwYXJhbWV0ZXIgYmVjb21lcyAlcCAnLCBhc3luYyAoY3JlYXRlQ3VzdG9tZXJNYXN0ZXJLZXksIHBhcmFtS2V5SWQpID0+IHtcbiAgICAgIC8vIEdJVkVOOiBubyBleGlzdGluZyBzdGFja1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIGNyZWF0ZUN1c3RvbWVyTWFzdGVyS2V5LFxuICAgICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM6IFsnYXJuOmJvb2gnXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QobW9ja0RlcGxveVN0YWNrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgIHBhcmFtZXRlcnM6IGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgICBGaWxlQXNzZXRzQnVja2V0S21zS2V5SWQ6IHBhcmFtS2V5SWQsXG4gICAgICAgIH0pLFxuICAgICAgfSkpO1xuICAgIH0pO1xuXG4gICAgdGVzdC5lYWNoKFtcbiAgICAgIC8vIE9sZCBib290c3RyYXAgc3RhY2sgYmVpbmcgdXBncmFkZWQgdG8gbmV3IG9uZVxuICAgICAgW3VuZGVmaW5lZCwgdW5kZWZpbmVkLCAnQVdTX01BTkFHRURfS0VZJ10sXG4gICAgICAvLyBUaGVyZSBpcyBhIHZhbHVlLCB1c2VyIGRvZXNuJ3QgcmVxdWVzdCBhIGNoYW5nZVxuICAgICAgWydhcm46YXdzOmtleScsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXSxcbiAgICAgIC8vIFN3aXRjaCBvZmYgZXhpc3Rpbmcga2V5XG4gICAgICBbJ2Fybjphd3M6a2V5JywgZmFsc2UsICdBV1NfTUFOQUdFRF9LRVknXSxcbiAgICAgIC8vIFN3aXRjaCBvbiBleGlzdGluZyBrZXlcbiAgICAgIFsnQVdTX01BTkFHRURfS0VZJywgdHJ1ZSwgJyddLFxuICAgIF0pKCcodXBncmFkaW5nKSBjdXJyZW50IHBhcmFtICVwLCBjcmVhdGVDdXN0b21lck1hc3RlcktleT0lcCA9PiBwYXJhbWV0ZXIgYmVjb21lcyAlcCAnLCBhc3luYyAoY3VycmVudEtleUlkLCBjcmVhdGVDdXN0b21lck1hc3RlcktleSwgcGFyYW1LZXlJZCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIG1vY2tUaGVUb29sa2l0SW5mbyA9IG1vY2tUb29sa2l0U3RhY2tJbmZvKHtcbiAgICAgICAgUGFyYW1ldGVyczogY3VycmVudEtleUlkID8gW3sgUGFyYW1ldGVyS2V5OiAnRmlsZUFzc2V0c0J1Y2tldEttc0tleUlkJywgUGFyYW1ldGVyVmFsdWU6IGN1cnJlbnRLZXlJZCB9XSA6IHVuZGVmaW5lZCxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIGNyZWF0ZUN1c3RvbWVyTWFzdGVyS2V5LFxuICAgICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM6IFsnYXJuOmJvb2gnXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QobW9ja0RlcGxveVN0YWNrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgIHBhcmFtZXRlcnM6IGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgICBGaWxlQXNzZXRzQnVja2V0S21zS2V5SWQ6IHBhcmFtS2V5SWQsXG4gICAgICAgIH0pLFxuICAgICAgfSkpO1xuICAgIH0pO1xuICB9KTtcbn0pOyJdfQ==