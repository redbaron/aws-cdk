"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockToolkitInfoLookup = jest.fn();
jest.mock('../../lib/api/deploy-stack');
jest.mock('../../lib/api/toolkit-info', () => ({
    ToolkitResourcesInfo: {
        lookup: mockToolkitInfoLookup,
    },
}));
const cloudformation_deployments_1 = require("../../lib/api/cloudformation-deployments");
const deploy_stack_1 = require("../../lib/api/deploy-stack");
const util_1 = require("../util");
const mock_sdk_1 = require("../util/mock-sdk");
let sdkProvider;
let deployments;
beforeEach(() => {
    jest.resetAllMocks();
    sdkProvider = new mock_sdk_1.MockSdkProvider();
    deployments = new cloudformation_deployments_1.CloudFormationDeployments({ sdkProvider });
});
test('placeholders are substituted in CloudFormation execution role', async () => {
    await deployments.deployStack({
        stack: util_1.testStack({
            stackName: 'boop',
            properties: {
                cloudFormationExecutionRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
            },
        }),
    });
    expect(deploy_stack_1.deployStack).toHaveBeenCalledWith(expect.objectContaining({
        roleArn: 'bloop:here:123456789012',
    }));
});
test('role with placeholders is assumed if assumerole is given', async () => {
    const mockForEnvironment = jest.fn();
    sdkProvider.forEnvironment = mockForEnvironment;
    await deployments.deployStack({
        stack: util_1.testStack({
            stackName: 'boop',
            properties: {
                assumeRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
            },
        }),
    });
    expect(mockForEnvironment).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
        assumeRoleArn: 'bloop:here:123456789012',
    }));
});
test('deployment fails if bootstrap stack is missing', async () => {
    await expect(deployments.deployStack({
        stack: util_1.testStack({
            stackName: 'boop',
            properties: {
                assumeRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
                requiresBootstrapStackVersion: 99,
            },
        }),
    })).rejects.toThrow(/no bootstrap stack found/);
});
test('deployment fails if bootstrap stack is too old', async () => {
    mockToolkitInfoLookup.mockResolvedValue({
        version: 5,
    });
    await expect(deployments.deployStack({
        stack: util_1.testStack({
            stackName: 'boop',
            properties: {
                assumeRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
                requiresBootstrapStackVersion: 99,
            },
        }),
    })).rejects.toThrow(/requires bootstrap stack version '99', found '5'/);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWRmb3JtYXRpb24tZGVwbG95bWVudHMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsb3VkZm9ybWF0aW9uLWRlcGxveW1lbnRzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztBQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLENBQUM7QUFDeEMsSUFBSSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQzdDLG9CQUFvQixFQUFFO1FBQ3BCLE1BQU0sRUFBRSxxQkFBcUI7S0FDOUI7Q0FDRixDQUFDLENBQUMsQ0FBQztBQUVKLHlGQUFxRjtBQUNyRiw2REFBeUQ7QUFDekQsa0NBQW9DO0FBQ3BDLCtDQUFtRDtBQUVuRCxJQUFJLFdBQTRCLENBQUM7QUFDakMsSUFBSSxXQUFzQyxDQUFDO0FBQzNDLFVBQVUsQ0FBQyxHQUFHLEVBQUU7SUFDZCxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDckIsV0FBVyxHQUFHLElBQUksMEJBQWUsRUFBRSxDQUFDO0lBQ3BDLFdBQVcsR0FBRyxJQUFJLHNEQUF5QixDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztBQUMvRCxDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQywrREFBK0QsRUFBRSxLQUFLLElBQUksRUFBRTtJQUMvRSxNQUFNLFdBQVcsQ0FBQyxXQUFXLENBQUM7UUFDNUIsS0FBSyxFQUFFLGdCQUFTLENBQUM7WUFDZixTQUFTLEVBQUUsTUFBTTtZQUNqQixVQUFVLEVBQUU7Z0JBQ1YsOEJBQThCLEVBQUUsd0NBQXdDO2FBQ3pFO1NBQ0YsQ0FBQztLQUNILENBQUMsQ0FBQztJQUVILE1BQU0sQ0FBQywwQkFBVyxDQUFDLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDO1FBQy9ELE9BQU8sRUFBRSx5QkFBeUI7S0FDbkMsQ0FBQyxDQUFDLENBQUM7QUFDTixDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQywwREFBMEQsRUFBRSxLQUFLLElBQUksRUFBRTtJQUMxRSxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztJQUNyQyxXQUFXLENBQUMsY0FBYyxHQUFHLGtCQUFrQixDQUFDO0lBRWhELE1BQU0sV0FBVyxDQUFDLFdBQVcsQ0FBQztRQUM1QixLQUFLLEVBQUUsZ0JBQVMsQ0FBQztZQUNmLFNBQVMsRUFBRSxNQUFNO1lBQ2pCLFVBQVUsRUFBRTtnQkFDVixhQUFhLEVBQUUsd0NBQXdDO2FBQ3hEO1NBQ0YsQ0FBQztLQUNILENBQUMsQ0FBQztJQUVILE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRSxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixDQUFDO1FBQzVHLGFBQWEsRUFBRSx5QkFBeUI7S0FDekMsQ0FBQyxDQUFDLENBQUM7QUFDTixDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQyxnREFBZ0QsRUFBRSxLQUFLLElBQUksRUFBRTtJQUNoRSxNQUFNLE1BQU0sQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDO1FBQ25DLEtBQUssRUFBRSxnQkFBUyxDQUFDO1lBQ2YsU0FBUyxFQUFFLE1BQU07WUFDakIsVUFBVSxFQUFFO2dCQUNWLGFBQWEsRUFBRSx3Q0FBd0M7Z0JBQ3ZELDZCQUE2QixFQUFFLEVBQUU7YUFDbEM7U0FDRixDQUFDO0tBQ0gsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0FBQ2xELENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBSSxDQUFDLGdEQUFnRCxFQUFFLEtBQUssSUFBSSxFQUFFO0lBQ2hFLHFCQUFxQixDQUFDLGlCQUFpQixDQUFDO1FBQ3RDLE9BQU8sRUFBRSxDQUFDO0tBQ1gsQ0FBQyxDQUFDO0lBRUgsTUFBTSxNQUFNLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQztRQUNuQyxLQUFLLEVBQUUsZ0JBQVMsQ0FBQztZQUNmLFNBQVMsRUFBRSxNQUFNO1lBQ2pCLFVBQVUsRUFBRTtnQkFDVixhQUFhLEVBQUUsd0NBQXdDO2dCQUN2RCw2QkFBNkIsRUFBRSxFQUFFO2FBQ2xDO1NBQ0YsQ0FBQztLQUNILENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsa0RBQWtELENBQUMsQ0FBQztBQUMxRSxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IG1vY2tUb29sa2l0SW5mb0xvb2t1cCA9IGplc3QuZm4oKTtcbmplc3QubW9jaygnLi4vLi4vbGliL2FwaS9kZXBsb3ktc3RhY2snKTtcbmplc3QubW9jaygnLi4vLi4vbGliL2FwaS90b29sa2l0LWluZm8nLCAoKSA9PiAoe1xuICBUb29sa2l0UmVzb3VyY2VzSW5mbzoge1xuICAgIGxvb2t1cDogbW9ja1Rvb2xraXRJbmZvTG9va3VwLFxuICB9LFxufSkpO1xuXG5pbXBvcnQgeyBDbG91ZEZvcm1hdGlvbkRlcGxveW1lbnRzIH0gZnJvbSAnLi4vLi4vbGliL2FwaS9jbG91ZGZvcm1hdGlvbi1kZXBsb3ltZW50cyc7XG5pbXBvcnQgeyBkZXBsb3lTdGFjayB9IGZyb20gJy4uLy4uL2xpYi9hcGkvZGVwbG95LXN0YWNrJztcbmltcG9ydCB7IHRlc3RTdGFjayB9IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHsgTW9ja1Nka1Byb3ZpZGVyIH0gZnJvbSAnLi4vdXRpbC9tb2NrLXNkayc7XG5cbmxldCBzZGtQcm92aWRlcjogTW9ja1Nka1Byb3ZpZGVyO1xubGV0IGRlcGxveW1lbnRzOiBDbG91ZEZvcm1hdGlvbkRlcGxveW1lbnRzO1xuYmVmb3JlRWFjaCgoKSA9PiB7XG4gIGplc3QucmVzZXRBbGxNb2NrcygpO1xuICBzZGtQcm92aWRlciA9IG5ldyBNb2NrU2RrUHJvdmlkZXIoKTtcbiAgZGVwbG95bWVudHMgPSBuZXcgQ2xvdWRGb3JtYXRpb25EZXBsb3ltZW50cyh7IHNka1Byb3ZpZGVyIH0pO1xufSk7XG5cbnRlc3QoJ3BsYWNlaG9sZGVycyBhcmUgc3Vic3RpdHV0ZWQgaW4gQ2xvdWRGb3JtYXRpb24gZXhlY3V0aW9uIHJvbGUnLCBhc3luYyAoKSA9PiB7XG4gIGF3YWl0IGRlcGxveW1lbnRzLmRlcGxveVN0YWNrKHtcbiAgICBzdGFjazogdGVzdFN0YWNrKHtcbiAgICAgIHN0YWNrTmFtZTogJ2Jvb3AnLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblJvbGVBcm46ICdibG9vcDoke0FXUzo6UmVnaW9ufToke0FXUzo6QWNjb3VudElkfScsXG4gICAgICB9LFxuICAgIH0pLFxuICB9KTtcblxuICBleHBlY3QoZGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICByb2xlQXJuOiAnYmxvb3A6aGVyZToxMjM0NTY3ODkwMTInLFxuICB9KSk7XG59KTtcblxudGVzdCgncm9sZSB3aXRoIHBsYWNlaG9sZGVycyBpcyBhc3N1bWVkIGlmIGFzc3VtZXJvbGUgaXMgZ2l2ZW4nLCBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IG1vY2tGb3JFbnZpcm9ubWVudCA9IGplc3QuZm4oKTtcbiAgc2RrUHJvdmlkZXIuZm9yRW52aXJvbm1lbnQgPSBtb2NrRm9yRW52aXJvbm1lbnQ7XG5cbiAgYXdhaXQgZGVwbG95bWVudHMuZGVwbG95U3RhY2soe1xuICAgIHN0YWNrOiB0ZXN0U3RhY2soe1xuICAgICAgc3RhY2tOYW1lOiAnYm9vcCcsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcDoke0FXUzo6UmVnaW9ufToke0FXUzo6QWNjb3VudElkfScsXG4gICAgICB9LFxuICAgIH0pLFxuICB9KTtcblxuICBleHBlY3QobW9ja0ZvckVudmlyb25tZW50KS50b0hhdmVCZWVuQ2FsbGVkV2l0aChleHBlY3QuYW55dGhpbmcoKSwgZXhwZWN0LmFueXRoaW5nKCksIGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICBhc3N1bWVSb2xlQXJuOiAnYmxvb3A6aGVyZToxMjM0NTY3ODkwMTInLFxuICB9KSk7XG59KTtcblxudGVzdCgnZGVwbG95bWVudCBmYWlscyBpZiBib290c3RyYXAgc3RhY2sgaXMgbWlzc2luZycsIGFzeW5jICgpID0+IHtcbiAgYXdhaXQgZXhwZWN0KGRlcGxveW1lbnRzLmRlcGxveVN0YWNrKHtcbiAgICBzdGFjazogdGVzdFN0YWNrKHtcbiAgICAgIHN0YWNrTmFtZTogJ2Jvb3AnLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBhc3N1bWVSb2xlQXJuOiAnYmxvb3A6JHtBV1M6OlJlZ2lvbn06JHtBV1M6OkFjY291bnRJZH0nLFxuICAgICAgICByZXF1aXJlc0Jvb3RzdHJhcFN0YWNrVmVyc2lvbjogOTksXG4gICAgICB9LFxuICAgIH0pLFxuICB9KSkucmVqZWN0cy50b1Rocm93KC9ubyBib290c3RyYXAgc3RhY2sgZm91bmQvKTtcbn0pO1xuXG50ZXN0KCdkZXBsb3ltZW50IGZhaWxzIGlmIGJvb3RzdHJhcCBzdGFjayBpcyB0b28gb2xkJywgYXN5bmMgKCkgPT4ge1xuICBtb2NrVG9vbGtpdEluZm9Mb29rdXAubW9ja1Jlc29sdmVkVmFsdWUoe1xuICAgIHZlcnNpb246IDUsXG4gIH0pO1xuXG4gIGF3YWl0IGV4cGVjdChkZXBsb3ltZW50cy5kZXBsb3lTdGFjayh7XG4gICAgc3RhY2s6IHRlc3RTdGFjayh7XG4gICAgICBzdGFja05hbWU6ICdib29wJyxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgYXNzdW1lUm9sZUFybjogJ2Jsb29wOiR7QVdTOjpSZWdpb259OiR7QVdTOjpBY2NvdW50SWR9JyxcbiAgICAgICAgcmVxdWlyZXNCb290c3RyYXBTdGFja1ZlcnNpb246IDk5LFxuICAgICAgfSxcbiAgICB9KSxcbiAgfSkpLnJlamVjdHMudG9UaHJvdygvcmVxdWlyZXMgYm9vdHN0cmFwIHN0YWNrIHZlcnNpb24gJzk5JywgZm91bmQgJzUnLyk7XG59KTtcbiJdfQ==