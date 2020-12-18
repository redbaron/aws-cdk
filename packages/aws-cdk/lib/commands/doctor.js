"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realHandler = exports.handler = exports.builder = exports.describe = exports.command = void 0;
const process = require("process");
const cxapi = require("@aws-cdk/cx-api");
const colors = require("colors/safe");
const logging_1 = require("../../lib/logging");
const version = require("../../lib/version");
exports.command = 'doctor';
exports.describe = 'Check your set-up for potential problems';
exports.builder = {};
function handler(args) {
    args.commandHandler = realHandler;
}
exports.handler = handler;
async function realHandler(_options) {
    let exitStatus = 0;
    for (const verification of verifications) {
        if (!await verification()) {
            exitStatus = -1;
        }
    }
    await version.displayVersionMessage();
    return exitStatus;
}
exports.realHandler = realHandler;
const verifications = [
    displayVersionInformation,
    displayAwsEnvironmentVariables,
    displayCdkEnvironmentVariables,
];
// ### Verifications ###
function displayVersionInformation() {
    logging_1.print(`ℹ️ CDK Version: ${colors.green(version.DISPLAY_VERSION)}`);
    return true;
}
function displayAwsEnvironmentVariables() {
    const keys = Object.keys(process.env).filter(s => s.startsWith('AWS_'));
    if (keys.length === 0) {
        logging_1.print('ℹ️ No AWS environment variables');
        return true;
    }
    logging_1.print('ℹ️ AWS environment variables:');
    for (const key of keys) {
        logging_1.print(`  - ${colors.blue(key)} = ${colors.green(anonymizeAwsVariable(key, process.env[key]))}`);
    }
    return true;
}
function displayCdkEnvironmentVariables() {
    const keys = Object.keys(process.env).filter(s => s.startsWith('CDK_'));
    if (keys.length === 0) {
        logging_1.print('ℹ️ No CDK environment variables');
        return true;
    }
    logging_1.print('ℹ️ CDK environment variables:');
    let healthy = true;
    for (const key of keys.sort()) {
        if (key === cxapi.CONTEXT_ENV || key === cxapi.OUTDIR_ENV) {
            logging_1.print(`  - ${colors.red(key)} = ${colors.green(process.env[key])} (⚠️ reserved for use by the CDK toolkit)`);
            healthy = false;
        }
        else {
            logging_1.print(`  - ${colors.blue(key)} = ${colors.green(process.env[key])}`);
        }
    }
    return healthy;
}
function anonymizeAwsVariable(name, value) {
    if (name === 'AWS_ACCESS_KEY_ID') {
        return value.substr(0, 4) + '<redacted>';
    } // Show ASIA/AKIA key type, but hide identifier
    if (name === 'AWS_SECRET_ACCESS_KEY' || name === 'AWS_SESSION_TOKEN' || name === 'AWS_SECURITY_TOKEN') {
        return '<redacted>';
    }
    return value;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9jdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZG9jdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyx5Q0FBeUM7QUFDekMsc0NBQXNDO0FBRXRDLCtDQUEwQztBQUMxQyw2Q0FBNkM7QUFHaEMsUUFBQSxPQUFPLEdBQUcsUUFBUSxDQUFDO0FBQ25CLFFBQUEsUUFBUSxHQUFHLDBDQUEwQyxDQUFDO0FBQ3RELFFBQUEsT0FBTyxHQUFHLEVBQUUsQ0FBQztBQUUxQixTQUFnQixPQUFPLENBQUMsSUFBcUI7SUFDM0MsSUFBSSxDQUFDLGNBQWMsR0FBRyxXQUFXLENBQUM7QUFDcEMsQ0FBQztBQUZELDBCQUVDO0FBRU0sS0FBSyxVQUFVLFdBQVcsQ0FBQyxRQUF3QjtJQUN4RCxJQUFJLFVBQVUsR0FBVyxDQUFDLENBQUM7SUFDM0IsS0FBSyxNQUFNLFlBQVksSUFBSSxhQUFhLEVBQUU7UUFDeEMsSUFBSSxDQUFDLE1BQU0sWUFBWSxFQUFFLEVBQUU7WUFDekIsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQ2pCO0tBQ0Y7SUFDRCxNQUFNLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO0lBQ3RDLE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFURCxrQ0FTQztBQUVELE1BQU0sYUFBYSxHQUE0QztJQUM3RCx5QkFBeUI7SUFDekIsOEJBQThCO0lBQzlCLDhCQUE4QjtDQUMvQixDQUFDO0FBRUYsd0JBQXdCO0FBRXhCLFNBQVMseUJBQXlCO0lBQ2hDLGVBQUssQ0FBQyxtQkFBbUIsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2xFLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVELFNBQVMsOEJBQThCO0lBQ3JDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUN4RSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3JCLGVBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1FBQ3pDLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFDRCxlQUFLLENBQUMsK0JBQStCLENBQUMsQ0FBQztJQUN2QyxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRTtRQUN0QixlQUFLLENBQUMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUNsRztJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVELFNBQVMsOEJBQThCO0lBQ3JDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUN4RSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3JCLGVBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1FBQ3pDLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFDRCxlQUFLLENBQUMsK0JBQStCLENBQUMsQ0FBQztJQUN2QyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUM7SUFDbkIsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUU7UUFDN0IsSUFBSSxHQUFHLEtBQUssS0FBSyxDQUFDLFdBQVcsSUFBSSxHQUFHLEtBQUssS0FBSyxDQUFDLFVBQVUsRUFBRTtZQUN6RCxlQUFLLENBQUMsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUUsQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO1lBQzlHLE9BQU8sR0FBRyxLQUFLLENBQUM7U0FDakI7YUFBTTtZQUNMLGVBQUssQ0FBQyxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQ3ZFO0tBQ0Y7SUFDRCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBRUQsU0FBUyxvQkFBb0IsQ0FBQyxJQUFZLEVBQUUsS0FBYTtJQUN2RCxJQUFJLElBQUksS0FBSyxtQkFBbUIsRUFBRTtRQUFFLE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDO0tBQUUsQ0FBQywrQ0FBK0M7SUFDL0gsSUFBSSxJQUFJLEtBQUssdUJBQXVCLElBQUksSUFBSSxLQUFLLG1CQUFtQixJQUFJLElBQUksS0FBSyxvQkFBb0IsRUFBRTtRQUFFLE9BQU8sWUFBWSxDQUFDO0tBQUU7SUFDL0gsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgcHJvY2VzcyBmcm9tICdwcm9jZXNzJztcbmltcG9ydCAqIGFzIGN4YXBpIGZyb20gJ0Bhd3MtY2RrL2N4LWFwaSc7XG5pbXBvcnQgKiBhcyBjb2xvcnMgZnJvbSAnY29sb3JzL3NhZmUnO1xuaW1wb3J0ICogYXMgeWFyZ3MgZnJvbSAneWFyZ3MnO1xuaW1wb3J0IHsgcHJpbnQgfSBmcm9tICcuLi8uLi9saWIvbG9nZ2luZyc7XG5pbXBvcnQgKiBhcyB2ZXJzaW9uIGZyb20gJy4uLy4uL2xpYi92ZXJzaW9uJztcbmltcG9ydCB7IENvbW1hbmRPcHRpb25zIH0gZnJvbSAnLi4vY29tbWFuZC1hcGknO1xuXG5leHBvcnQgY29uc3QgY29tbWFuZCA9ICdkb2N0b3InO1xuZXhwb3J0IGNvbnN0IGRlc2NyaWJlID0gJ0NoZWNrIHlvdXIgc2V0LXVwIGZvciBwb3RlbnRpYWwgcHJvYmxlbXMnO1xuZXhwb3J0IGNvbnN0IGJ1aWxkZXIgPSB7fTtcblxuZXhwb3J0IGZ1bmN0aW9uIGhhbmRsZXIoYXJnczogeWFyZ3MuQXJndW1lbnRzKSB7XG4gIGFyZ3MuY29tbWFuZEhhbmRsZXIgPSByZWFsSGFuZGxlcjtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWxIYW5kbGVyKF9vcHRpb25zOiBDb21tYW5kT3B0aW9ucyk6IFByb21pc2U8bnVtYmVyPiB7XG4gIGxldCBleGl0U3RhdHVzOiBudW1iZXIgPSAwO1xuICBmb3IgKGNvbnN0IHZlcmlmaWNhdGlvbiBvZiB2ZXJpZmljYXRpb25zKSB7XG4gICAgaWYgKCFhd2FpdCB2ZXJpZmljYXRpb24oKSkge1xuICAgICAgZXhpdFN0YXR1cyA9IC0xO1xuICAgIH1cbiAgfVxuICBhd2FpdCB2ZXJzaW9uLmRpc3BsYXlWZXJzaW9uTWVzc2FnZSgpO1xuICByZXR1cm4gZXhpdFN0YXR1cztcbn1cblxuY29uc3QgdmVyaWZpY2F0aW9uczogQXJyYXk8KCkgPT4gYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj4+ID0gW1xuICBkaXNwbGF5VmVyc2lvbkluZm9ybWF0aW9uLFxuICBkaXNwbGF5QXdzRW52aXJvbm1lbnRWYXJpYWJsZXMsXG4gIGRpc3BsYXlDZGtFbnZpcm9ubWVudFZhcmlhYmxlcyxcbl07XG5cbi8vICMjIyBWZXJpZmljYXRpb25zICMjI1xuXG5mdW5jdGlvbiBkaXNwbGF5VmVyc2lvbkluZm9ybWF0aW9uKCkge1xuICBwcmludChg4oS577iPIENESyBWZXJzaW9uOiAke2NvbG9ycy5ncmVlbih2ZXJzaW9uLkRJU1BMQVlfVkVSU0lPTil9YCk7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBkaXNwbGF5QXdzRW52aXJvbm1lbnRWYXJpYWJsZXMoKSB7XG4gIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwcm9jZXNzLmVudikuZmlsdGVyKHMgPT4gcy5zdGFydHNXaXRoKCdBV1NfJykpO1xuICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICBwcmludCgn4oS577iPIE5vIEFXUyBlbnZpcm9ubWVudCB2YXJpYWJsZXMnKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBwcmludCgn4oS577iPIEFXUyBlbnZpcm9ubWVudCB2YXJpYWJsZXM6Jyk7XG4gIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcbiAgICBwcmludChgICAtICR7Y29sb3JzLmJsdWUoa2V5KX0gPSAke2NvbG9ycy5ncmVlbihhbm9ueW1pemVBd3NWYXJpYWJsZShrZXksIHByb2Nlc3MuZW52W2tleV0hKSl9YCk7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGRpc3BsYXlDZGtFbnZpcm9ubWVudFZhcmlhYmxlcygpIHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHByb2Nlc3MuZW52KS5maWx0ZXIocyA9PiBzLnN0YXJ0c1dpdGgoJ0NES18nKSk7XG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHByaW50KCfihLnvuI8gTm8gQ0RLIGVudmlyb25tZW50IHZhcmlhYmxlcycpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHByaW50KCfihLnvuI8gQ0RLIGVudmlyb25tZW50IHZhcmlhYmxlczonKTtcbiAgbGV0IGhlYWx0aHkgPSB0cnVlO1xuICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzLnNvcnQoKSkge1xuICAgIGlmIChrZXkgPT09IGN4YXBpLkNPTlRFWFRfRU5WIHx8IGtleSA9PT0gY3hhcGkuT1VURElSX0VOVikge1xuICAgICAgcHJpbnQoYCAgLSAke2NvbG9ycy5yZWQoa2V5KX0gPSAke2NvbG9ycy5ncmVlbihwcm9jZXNzLmVudltrZXldISl9ICjimqDvuI8gcmVzZXJ2ZWQgZm9yIHVzZSBieSB0aGUgQ0RLIHRvb2xraXQpYCk7XG4gICAgICBoZWFsdGh5ID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByaW50KGAgIC0gJHtjb2xvcnMuYmx1ZShrZXkpfSA9ICR7Y29sb3JzLmdyZWVuKHByb2Nlc3MuZW52W2tleV0hKX1gKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGhlYWx0aHk7XG59XG5cbmZ1bmN0aW9uIGFub255bWl6ZUF3c1ZhcmlhYmxlKG5hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuICBpZiAobmFtZSA9PT0gJ0FXU19BQ0NFU1NfS0VZX0lEJykgeyByZXR1cm4gdmFsdWUuc3Vic3RyKDAsIDQpICsgJzxyZWRhY3RlZD4nOyB9IC8vIFNob3cgQVNJQS9BS0lBIGtleSB0eXBlLCBidXQgaGlkZSBpZGVudGlmaWVyXG4gIGlmIChuYW1lID09PSAnQVdTX1NFQ1JFVF9BQ0NFU1NfS0VZJyB8fCBuYW1lID09PSAnQVdTX1NFU1NJT05fVE9LRU4nIHx8IG5hbWUgPT09ICdBV1NfU0VDVVJJVFlfVE9LRU4nKSB7IHJldHVybiAnPHJlZGFjdGVkPic7IH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuIl19