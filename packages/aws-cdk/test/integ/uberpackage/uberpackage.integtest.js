"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cdk_1 = require("../helpers/cdk");
const test_helpers_1 = require("../helpers/test-helpers");
jest.setTimeout(600000);
describe('uberpackage', () => {
    test_helpers_1.integTest('works with cloudformation-include', cdk_1.withMonolithicCfnIncludeCdkApp(async (fixture) => {
        fixture.log('Starting test of cfn-include with monolithic CDK');
        await fixture.cdkSynth();
    }));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWJlcnBhY2thZ2UuaW50ZWd0ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidWJlcnBhY2thZ2UuaW50ZWd0ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsd0NBQWdFO0FBQ2hFLDBEQUFvRDtBQUVwRCxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU8sQ0FBQyxDQUFDO0FBRXpCLFFBQVEsQ0FBQyxhQUFhLEVBQUUsR0FBRyxFQUFFO0lBQzNCLHdCQUFTLENBQUMsbUNBQW1DLEVBQUUsb0NBQThCLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxFQUFFO1FBQzlGLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0RBQWtELENBQUMsQ0FBQztRQUVoRSxNQUFNLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUMzQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ04sQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB3aXRoTW9ub2xpdGhpY0NmbkluY2x1ZGVDZGtBcHAgfSBmcm9tICcuLi9oZWxwZXJzL2Nkayc7XG5pbXBvcnQgeyBpbnRlZ1Rlc3QgfSBmcm9tICcuLi9oZWxwZXJzL3Rlc3QtaGVscGVycyc7XG5cbmplc3Quc2V0VGltZW91dCg2MDBfMDAwKTtcblxuZGVzY3JpYmUoJ3ViZXJwYWNrYWdlJywgKCkgPT4ge1xuICBpbnRlZ1Rlc3QoJ3dvcmtzIHdpdGggY2xvdWRmb3JtYXRpb24taW5jbHVkZScsIHdpdGhNb25vbGl0aGljQ2ZuSW5jbHVkZUNka0FwcChhc3luYyAoZml4dHVyZSkgPT4ge1xuICAgIGZpeHR1cmUubG9nKCdTdGFydGluZyB0ZXN0IG9mIGNmbi1pbmNsdWRlIHdpdGggbW9ub2xpdGhpYyBDREsnKTtcblxuICAgIGF3YWl0IGZpeHR1cmUuY2RrU3ludGgoKTtcbiAgfSkpO1xufSk7XG4iXX0=