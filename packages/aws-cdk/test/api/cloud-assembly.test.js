"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cloud_assembly_1 = require("../../lib/api/cxapp/cloud-assembly");
const util_1 = require("../util");
test('do not throw when selecting stack without errors', async () => {
    // GIVEN
    const cxasm = await testCloudAssembly();
    // WHEN
    const selected = await cxasm.selectStacks(['withouterrors'], {
        defaultBehavior: cloud_assembly_1.DefaultSelection.AllStacks,
    });
    selected.processMetadataMessages();
    // THEN
    expect(selected.firstStack.template.resource).toBe('noerrorresource');
});
test('do throw when selecting stack with errors', async () => {
    // GIVEN
    const cxasm = await testCloudAssembly();
    // WHEN
    const selected = await cxasm.selectStacks(['witherrors'], {
        defaultBehavior: cloud_assembly_1.DefaultSelection.AllStacks,
    });
    // THEN
    expect(() => selected.processMetadataMessages()).toThrow(/Found errors/);
});
test('select behavior: all', async () => {
    // GIVEN
    const cxasm = await testCloudAssembly();
    // WHEN
    const x = await cxasm.selectStacks([], { defaultBehavior: cloud_assembly_1.DefaultSelection.AllStacks });
    // THEN
    expect(x.stackCount).toBe(2);
});
test('select behavior: none', async () => {
    // GIVEN
    const cxasm = await testCloudAssembly();
    // WHEN
    const x = await cxasm.selectStacks([], { defaultBehavior: cloud_assembly_1.DefaultSelection.None });
    // THEN
    expect(x.stackCount).toBe(0);
});
test('select behavior: single', async () => {
    // GIVEN
    const cxasm = await testCloudAssembly();
    // WHEN
    await expect(cxasm.selectStacks([], { defaultBehavior: cloud_assembly_1.DefaultSelection.OnlySingle }))
        .rejects.toThrow('Since this app includes more than a single stack, specify which stacks to use (wildcards are supported) or specify `--all`');
});
test('select behavior: repeat', async () => {
    // GIVEN
    const cxasm = await testCloudAssembly();
    // WHEN
    const x = await cxasm.selectStacks(['withouterrors', 'withouterrors'], {
        defaultBehavior: cloud_assembly_1.DefaultSelection.AllStacks,
    });
    // THEN
    expect(x.stackCount).toBe(1);
});
async function testCloudAssembly({ env } = {}) {
    const cloudExec = new util_1.MockCloudExecutable({
        stacks: [{
                stackName: 'withouterrors',
                env,
                template: { resource: 'noerrorresource' },
            },
            {
                stackName: 'witherrors',
                env,
                template: { resource: 'errorresource' },
                metadata: {
                    '/resource': [
                        {
                            type: cxschema.ArtifactMetadataEntryType.ERROR,
                            data: 'this is an error',
                        },
                    ],
                },
            }],
    });
    return cloudExec.synthesize();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWQtYXNzZW1ibHkudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsb3VkLWFzc2VtYmx5LnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwyREFBMkQ7QUFDM0QsdUVBQXNFO0FBQ3RFLGtDQUE4QztBQUU5QyxJQUFJLENBQUMsa0RBQWtELEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDbEUsUUFBUTtJQUNSLE1BQU0sS0FBSyxHQUFHLE1BQU0saUJBQWlCLEVBQUUsQ0FBQztJQUV4QyxPQUFPO0lBQ1AsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsZUFBZSxDQUFDLEVBQUU7UUFDM0QsZUFBZSxFQUFFLGlDQUFnQixDQUFDLFNBQVM7S0FDNUMsQ0FBQyxDQUFDO0lBQ0gsUUFBUSxDQUFDLHVCQUF1QixFQUFFLENBQUM7SUFFbkMsT0FBTztJQUNQLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUN4RSxDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQywyQ0FBMkMsRUFBRSxLQUFLLElBQUksRUFBRTtJQUMzRCxRQUFRO0lBQ1IsTUFBTSxLQUFLLEdBQUcsTUFBTSxpQkFBaUIsRUFBRSxDQUFDO0lBRXhDLE9BQU87SUFDUCxNQUFNLFFBQVEsR0FBRyxNQUFNLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxZQUFZLENBQUMsRUFBRTtRQUN4RCxlQUFlLEVBQUUsaUNBQWdCLENBQUMsU0FBUztLQUM1QyxDQUFDLENBQUM7SUFFSCxPQUFPO0lBQ1AsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQzNFLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBSSxDQUFDLHNCQUFzQixFQUFFLEtBQUssSUFBSSxFQUFFO0lBQ3RDLFFBQVE7SUFDUixNQUFNLEtBQUssR0FBRyxNQUFNLGlCQUFpQixFQUFFLENBQUM7SUFFeEMsT0FBTztJQUNQLE1BQU0sQ0FBQyxHQUFHLE1BQU0sS0FBSyxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxlQUFlLEVBQUUsaUNBQWdCLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUV4RixPQUFPO0lBQ1AsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0IsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENBQUMsdUJBQXVCLEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDdkMsUUFBUTtJQUNSLE1BQU0sS0FBSyxHQUFHLE1BQU0saUJBQWlCLEVBQUUsQ0FBQztJQUV4QyxPQUFPO0lBQ1AsTUFBTSxDQUFDLEdBQUcsTUFBTSxLQUFLLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLGVBQWUsRUFBRSxpQ0FBZ0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRW5GLE9BQU87SUFDUCxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMvQixDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQyx5QkFBeUIsRUFBRSxLQUFLLElBQUksRUFBRTtJQUN6QyxRQUFRO0lBQ1IsTUFBTSxLQUFLLEdBQUcsTUFBTSxpQkFBaUIsRUFBRSxDQUFDO0lBRXhDLE9BQU87SUFDUCxNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLGVBQWUsRUFBRSxpQ0FBZ0IsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1NBQ25GLE9BQU8sQ0FBQyxPQUFPLENBQUMsNEhBQTRILENBQUMsQ0FBQztBQUNuSixDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQyx5QkFBeUIsRUFBRSxLQUFLLElBQUksRUFBRTtJQUN6QyxRQUFRO0lBQ1IsTUFBTSxLQUFLLEdBQUcsTUFBTSxpQkFBaUIsRUFBRSxDQUFDO0lBRXhDLE9BQU87SUFDUCxNQUFNLENBQUMsR0FBRyxNQUFNLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxlQUFlLEVBQUUsZUFBZSxDQUFDLEVBQUU7UUFDckUsZUFBZSxFQUFFLGlDQUFnQixDQUFDLFNBQVM7S0FDNUMsQ0FBQyxDQUFDO0lBRUgsT0FBTztJQUNQLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQy9CLENBQUMsQ0FBQyxDQUFDO0FBRUgsS0FBSyxVQUFVLGlCQUFpQixDQUFDLEVBQUUsR0FBRyxLQUFtRCxFQUFFO0lBQ3pGLE1BQU0sU0FBUyxHQUFHLElBQUksMEJBQW1CLENBQUM7UUFDeEMsTUFBTSxFQUFFLENBQUM7Z0JBQ1AsU0FBUyxFQUFFLGVBQWU7Z0JBQzFCLEdBQUc7Z0JBQ0gsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixFQUFFO2FBQzFDO1lBQ0Q7Z0JBQ0UsU0FBUyxFQUFFLFlBQVk7Z0JBQ3ZCLEdBQUc7Z0JBQ0gsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRTtnQkFDdkMsUUFBUSxFQUFFO29CQUNSLFdBQVcsRUFBRTt3QkFDWDs0QkFDRSxJQUFJLEVBQUUsUUFBUSxDQUFDLHlCQUF5QixDQUFDLEtBQUs7NEJBQzlDLElBQUksRUFBRSxrQkFBa0I7eUJBQ3pCO3FCQUNGO2lCQUNGO2FBQ0YsQ0FBQztLQUNILENBQUMsQ0FBQztJQUVILE9BQU8sU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDO0FBQ2hDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjeHNjaGVtYSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0IHsgRGVmYXVsdFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uL2xpYi9hcGkvY3hhcHAvY2xvdWQtYXNzZW1ibHknO1xuaW1wb3J0IHsgTW9ja0Nsb3VkRXhlY3V0YWJsZSB9IGZyb20gJy4uL3V0aWwnO1xuXG50ZXN0KCdkbyBub3QgdGhyb3cgd2hlbiBzZWxlY3Rpbmcgc3RhY2sgd2l0aG91dCBlcnJvcnMnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbnN0IGN4YXNtID0gYXdhaXQgdGVzdENsb3VkQXNzZW1ibHkoKTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHNlbGVjdGVkID0gYXdhaXQgY3hhc20uc2VsZWN0U3RhY2tzKFsnd2l0aG91dGVycm9ycyddLCB7XG4gICAgZGVmYXVsdEJlaGF2aW9yOiBEZWZhdWx0U2VsZWN0aW9uLkFsbFN0YWNrcyxcbiAgfSk7XG4gIHNlbGVjdGVkLnByb2Nlc3NNZXRhZGF0YU1lc3NhZ2VzKCk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3Qoc2VsZWN0ZWQuZmlyc3RTdGFjay50ZW1wbGF0ZS5yZXNvdXJjZSkudG9CZSgnbm9lcnJvcnJlc291cmNlJyk7XG59KTtcblxudGVzdCgnZG8gdGhyb3cgd2hlbiBzZWxlY3Rpbmcgc3RhY2sgd2l0aCBlcnJvcnMnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbnN0IGN4YXNtID0gYXdhaXQgdGVzdENsb3VkQXNzZW1ibHkoKTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHNlbGVjdGVkID0gYXdhaXQgY3hhc20uc2VsZWN0U3RhY2tzKFsnd2l0aGVycm9ycyddLCB7XG4gICAgZGVmYXVsdEJlaGF2aW9yOiBEZWZhdWx0U2VsZWN0aW9uLkFsbFN0YWNrcyxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QoKCkgPT4gc2VsZWN0ZWQucHJvY2Vzc01ldGFkYXRhTWVzc2FnZXMoKSkudG9UaHJvdygvRm91bmQgZXJyb3JzLyk7XG59KTtcblxudGVzdCgnc2VsZWN0IGJlaGF2aW9yOiBhbGwnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbnN0IGN4YXNtID0gYXdhaXQgdGVzdENsb3VkQXNzZW1ibHkoKTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHggPSBhd2FpdCBjeGFzbS5zZWxlY3RTdGFja3MoW10sIHsgZGVmYXVsdEJlaGF2aW9yOiBEZWZhdWx0U2VsZWN0aW9uLkFsbFN0YWNrcyB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdCh4LnN0YWNrQ291bnQpLnRvQmUoMik7XG59KTtcblxudGVzdCgnc2VsZWN0IGJlaGF2aW9yOiBub25lJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25zdCBjeGFzbSA9IGF3YWl0IHRlc3RDbG91ZEFzc2VtYmx5KCk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCB4ID0gYXdhaXQgY3hhc20uc2VsZWN0U3RhY2tzKFtdLCB7IGRlZmF1bHRCZWhhdmlvcjogRGVmYXVsdFNlbGVjdGlvbi5Ob25lIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KHguc3RhY2tDb3VudCkudG9CZSgwKTtcbn0pO1xuXG50ZXN0KCdzZWxlY3QgYmVoYXZpb3I6IHNpbmdsZScsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgY29uc3QgY3hhc20gPSBhd2FpdCB0ZXN0Q2xvdWRBc3NlbWJseSgpO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZXhwZWN0KGN4YXNtLnNlbGVjdFN0YWNrcyhbXSwgeyBkZWZhdWx0QmVoYXZpb3I6IERlZmF1bHRTZWxlY3Rpb24uT25seVNpbmdsZSB9KSlcbiAgICAucmVqZWN0cy50b1Rocm93KCdTaW5jZSB0aGlzIGFwcCBpbmNsdWRlcyBtb3JlIHRoYW4gYSBzaW5nbGUgc3RhY2ssIHNwZWNpZnkgd2hpY2ggc3RhY2tzIHRvIHVzZSAod2lsZGNhcmRzIGFyZSBzdXBwb3J0ZWQpIG9yIHNwZWNpZnkgYC0tYWxsYCcpO1xufSk7XG5cbnRlc3QoJ3NlbGVjdCBiZWhhdmlvcjogcmVwZWF0JywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25zdCBjeGFzbSA9IGF3YWl0IHRlc3RDbG91ZEFzc2VtYmx5KCk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCB4ID0gYXdhaXQgY3hhc20uc2VsZWN0U3RhY2tzKFsnd2l0aG91dGVycm9ycycsICd3aXRob3V0ZXJyb3JzJ10sIHtcbiAgICBkZWZhdWx0QmVoYXZpb3I6IERlZmF1bHRTZWxlY3Rpb24uQWxsU3RhY2tzLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdCh4LnN0YWNrQ291bnQpLnRvQmUoMSk7XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gdGVzdENsb3VkQXNzZW1ibHkoeyBlbnYgfTogeyBlbnY/OiBzdHJpbmcsIHZlcnNpb25SZXBvcnRpbmc/OiBib29sZWFuIH0gPSB7fSkge1xuICBjb25zdCBjbG91ZEV4ZWMgPSBuZXcgTW9ja0Nsb3VkRXhlY3V0YWJsZSh7XG4gICAgc3RhY2tzOiBbe1xuICAgICAgc3RhY2tOYW1lOiAnd2l0aG91dGVycm9ycycsXG4gICAgICBlbnYsXG4gICAgICB0ZW1wbGF0ZTogeyByZXNvdXJjZTogJ25vZXJyb3JyZXNvdXJjZScgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIHN0YWNrTmFtZTogJ3dpdGhlcnJvcnMnLFxuICAgICAgZW52LFxuICAgICAgdGVtcGxhdGU6IHsgcmVzb3VyY2U6ICdlcnJvcnJlc291cmNlJyB9LFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgJy9yZXNvdXJjZSc6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiBjeHNjaGVtYS5BcnRpZmFjdE1ldGFkYXRhRW50cnlUeXBlLkVSUk9SLFxuICAgICAgICAgICAgZGF0YTogJ3RoaXMgaXMgYW4gZXJyb3InLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH1dLFxuICB9KTtcblxuICByZXR1cm4gY2xvdWRFeGVjLnN5bnRoZXNpemUoKTtcbn1cbiJdfQ==