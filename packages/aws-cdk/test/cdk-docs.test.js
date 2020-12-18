"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockery = require("mockery");
const argv = {
    browser: 'echo %u',
    commandHandler: undefined,
};
describe('`cdk docs`', () => {
    beforeEach(done => {
        mockery.registerMock('../../lib/logging', {
            debug() { return; },
            error() { return; },
            print() { return; },
            warning() { return; },
        });
        mockery.enable({ useCleanCache: true, warnOnReplace: true, warnOnUnregistered: false });
        done();
    });
    afterAll(done => {
        mockery.disable();
        mockery.deregisterAll();
        done();
    });
    test('exits with 0 when everything is OK', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../lib/commands/docs').handler(argv);
        const result = await argv.commandHandler({ args: argv });
        expect(result).toBe(0);
    });
    test('exits with 0 when opening the browser fails', async () => {
        mockery.registerMock('child_process', {
            exec(_, cb) {
                cb(new Error('TEST'));
            },
        });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../lib/commands/docs').handler(argv);
        const result = await argv.commandHandler({ args: argv });
        expect(result).toBe(0);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLWRvY3MudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay1kb2NzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxtQ0FBbUM7QUFHbkMsTUFBTSxJQUFJLEdBQUc7SUFDWCxPQUFPLEVBQUUsU0FBUztJQUNsQixjQUFjLEVBQUUsU0FBeUM7Q0FDMUQsQ0FBQztBQUVGLFFBQVEsQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFO0lBQzFCLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNoQixPQUFPLENBQUMsWUFBWSxDQUFDLG1CQUFtQixFQUFFO1lBQ3hDLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQztZQUNuQixLQUFLLEtBQUssT0FBTyxDQUFDLENBQUM7WUFDbkIsS0FBSyxLQUFLLE9BQU8sQ0FBQyxDQUFDO1lBQ25CLE9BQU8sS0FBSyxPQUFPLENBQUMsQ0FBQztTQUN0QixDQUFDLENBQUM7UUFDSCxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDeEYsSUFBSSxFQUFFLENBQUM7SUFDVCxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNkLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNsQixPQUFPLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDeEIsSUFBSSxFQUFFLENBQUM7SUFDVCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxvQ0FBb0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNwRCxpRUFBaUU7UUFDakUsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlDLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWUsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQVMsQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekIsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsNkNBQTZDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDN0QsT0FBTyxDQUFDLFlBQVksQ0FBQyxlQUFlLEVBQUU7WUFDcEMsSUFBSSxDQUFDLENBQVMsRUFBRSxFQUEwRDtnQkFDeEUsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDeEIsQ0FBQztTQUNGLENBQUMsQ0FBQztRQUNILGlFQUFpRTtRQUNqRSxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUMsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBZSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBUyxDQUFDLENBQUM7UUFDakUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN6QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgbW9ja2VyeSBmcm9tICdtb2NrZXJ5JztcbmltcG9ydCB7IENvbW1hbmRIYW5kbGVyIH0gZnJvbSAnLi4vbGliL2NvbW1hbmQtYXBpJztcblxuY29uc3QgYXJndiA9IHtcbiAgYnJvd3NlcjogJ2VjaG8gJXUnLFxuICBjb21tYW5kSGFuZGxlcjogdW5kZWZpbmVkIGFzIChDb21tYW5kSGFuZGxlciB8IHVuZGVmaW5lZCksXG59O1xuXG5kZXNjcmliZSgnYGNkayBkb2NzYCcsICgpID0+IHtcbiAgYmVmb3JlRWFjaChkb25lID0+IHtcbiAgICBtb2NrZXJ5LnJlZ2lzdGVyTW9jaygnLi4vLi4vbGliL2xvZ2dpbmcnLCB7XG4gICAgICBkZWJ1ZygpIHsgcmV0dXJuOyB9LFxuICAgICAgZXJyb3IoKSB7IHJldHVybjsgfSxcbiAgICAgIHByaW50KCkgeyByZXR1cm47IH0sXG4gICAgICB3YXJuaW5nKCkgeyByZXR1cm47IH0sXG4gICAgfSk7XG4gICAgbW9ja2VyeS5lbmFibGUoeyB1c2VDbGVhbkNhY2hlOiB0cnVlLCB3YXJuT25SZXBsYWNlOiB0cnVlLCB3YXJuT25VbnJlZ2lzdGVyZWQ6IGZhbHNlIH0pO1xuICAgIGRvbmUoKTtcbiAgfSk7XG5cbiAgYWZ0ZXJBbGwoZG9uZSA9PiB7XG4gICAgbW9ja2VyeS5kaXNhYmxlKCk7XG4gICAgbW9ja2VyeS5kZXJlZ2lzdGVyQWxsKCk7XG4gICAgZG9uZSgpO1xuICB9KTtcblxuICB0ZXN0KCdleGl0cyB3aXRoIDAgd2hlbiBldmVyeXRoaW5nIGlzIE9LJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzXG4gICAgcmVxdWlyZSgnLi4vbGliL2NvbW1hbmRzL2RvY3MnKS5oYW5kbGVyKGFyZ3YpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFyZ3YuY29tbWFuZEhhbmRsZXIhKHsgYXJnczogYXJndiB9IGFzIGFueSk7XG4gICAgZXhwZWN0KHJlc3VsdCkudG9CZSgwKTtcbiAgfSk7XG5cbiAgdGVzdCgnZXhpdHMgd2l0aCAwIHdoZW4gb3BlbmluZyB0aGUgYnJvd3NlciBmYWlscycsIGFzeW5jICgpID0+IHtcbiAgICBtb2NrZXJ5LnJlZ2lzdGVyTW9jaygnY2hpbGRfcHJvY2VzcycsIHtcbiAgICAgIGV4ZWMoXzogc3RyaW5nLCBjYjogKGVycjogRXJyb3IsIHN0ZG91dD86IHN0cmluZywgc3RkZXJyPzogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgICAgIGNiKG5ldyBFcnJvcignVEVTVCcpKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHNcbiAgICByZXF1aXJlKCcuLi9saWIvY29tbWFuZHMvZG9jcycpLmhhbmRsZXIoYXJndik7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXJndi5jb21tYW5kSGFuZGxlciEoeyBhcmdzOiBhcmd2IH0gYXMgYW55KTtcbiAgICBleHBlY3QocmVzdWx0KS50b0JlKDApO1xuICB9KTtcbn0pO1xuIl19