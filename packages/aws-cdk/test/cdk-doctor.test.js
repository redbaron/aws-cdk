"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockery = require("mockery");
describe('`cdk doctor`', () => {
    beforeEach(done => {
        mockery.registerMock('../../lib/logging', {
            print: () => undefined,
        });
        mockery.enable({ useCleanCache: true, warnOnReplace: true, warnOnUnregistered: false });
        done();
    });
    afterEach(done => {
        mockery.disable();
        mockery.deregisterAll();
        done();
    });
    test('exits with 0 when everything is OK', async () => {
        const argv = {};
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../lib/commands/doctor').handler(argv);
        const result = await argv.commandHandler({ args: argv });
        expect(result).toBe(0);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLWRvY3Rvci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2RrLWRvY3Rvci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsbUNBQW1DO0FBR25DLFFBQVEsQ0FBQyxjQUFjLEVBQUUsR0FBRyxFQUFFO0lBQzVCLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNoQixPQUFPLENBQUMsWUFBWSxDQUFDLG1CQUFtQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO1NBQ3ZCLENBQUMsQ0FBQztRQUNILE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUN4RixJQUFJLEVBQUUsQ0FBQztJQUNULENBQUMsQ0FBQyxDQUFDO0lBRUgsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ2YsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2xCLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUN4QixJQUFJLEVBQUUsQ0FBQztJQUNULENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLG9DQUFvQyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3BELE1BQU0sSUFBSSxHQUFRLEVBQUUsQ0FBQztRQUNyQixpRUFBaUU7UUFDakUsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hELE1BQU0sTUFBTSxHQUFHLE1BQU8sSUFBSSxDQUFDLGNBQWlDLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFTLENBQUMsQ0FBQztRQUNwRixNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBtb2NrZXJ5IGZyb20gJ21vY2tlcnknO1xuaW1wb3J0IHsgQ29tbWFuZEhhbmRsZXIgfSBmcm9tICcuLi9saWIvY29tbWFuZC1hcGknO1xuXG5kZXNjcmliZSgnYGNkayBkb2N0b3JgJywgKCkgPT4ge1xuICBiZWZvcmVFYWNoKGRvbmUgPT4ge1xuICAgIG1vY2tlcnkucmVnaXN0ZXJNb2NrKCcuLi8uLi9saWIvbG9nZ2luZycsIHtcbiAgICAgIHByaW50OiAoKSA9PiB1bmRlZmluZWQsXG4gICAgfSk7XG4gICAgbW9ja2VyeS5lbmFibGUoeyB1c2VDbGVhbkNhY2hlOiB0cnVlLCB3YXJuT25SZXBsYWNlOiB0cnVlLCB3YXJuT25VbnJlZ2lzdGVyZWQ6IGZhbHNlIH0pO1xuICAgIGRvbmUoKTtcbiAgfSk7XG5cbiAgYWZ0ZXJFYWNoKGRvbmUgPT4ge1xuICAgIG1vY2tlcnkuZGlzYWJsZSgpO1xuICAgIG1vY2tlcnkuZGVyZWdpc3RlckFsbCgpO1xuICAgIGRvbmUoKTtcbiAgfSk7XG5cbiAgdGVzdCgnZXhpdHMgd2l0aCAwIHdoZW4gZXZlcnl0aGluZyBpcyBPSycsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBhcmd2OiBhbnkgPSB7fTtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0c1xuICAgIHJlcXVpcmUoJy4uL2xpYi9jb21tYW5kcy9kb2N0b3InKS5oYW5kbGVyKGFyZ3YpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IChhcmd2LmNvbW1hbmRIYW5kbGVyIGFzIENvbW1hbmRIYW5kbGVyKSh7IGFyZ3M6IGFyZ3YgfSBhcyBhbnkpO1xuICAgIGV4cGVjdChyZXN1bHQpLnRvQmUoMCk7XG4gIH0pO1xufSk7XG4iXX0=