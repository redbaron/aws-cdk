"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapVersionFromTemplate = exports.BootstrapStack = void 0;
const os = require("os");
const path = require("path");
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cxapi = require("@aws-cdk/cx-api");
const fs = require("fs-extra");
const aws_auth_1 = require("../aws-auth");
const deploy_stack_1 = require("../deploy-stack");
const toolkit_info_1 = require("../toolkit-info");
const bootstrap_props_1 = require("./bootstrap-props");
/**
 * A class to hold state around stack bootstrapping
 *
 * This class exists so we can break bootstrapping into 2 phases:
 *
 * ```ts
 * const current = BootstrapStack.lookup(...);
 * // ...
 * current.update(newTemplate, ...);
 * ```
 *
 * And do something in between the two phases (such as look at the
 * current bootstrap stack and doing something intelligent).
 *
 * This class is different from `ToolkitInfo` in that `ToolkitInfo`
 * is purely read-only, and `ToolkitInfo.lookup()` returns `undefined`
 * if the stack does not exist. But honestly, these classes could and
 * should probably be merged at some point.
 */
class BootstrapStack {
    constructor(sdkProvider, sdk, resolvedEnvironment, toolkitStackName, currentToolkitInfo) {
        this.sdkProvider = sdkProvider;
        this.sdk = sdk;
        this.resolvedEnvironment = resolvedEnvironment;
        this.toolkitStackName = toolkitStackName;
        this.currentToolkitInfo = currentToolkitInfo;
    }
    static async lookup(sdkProvider, environment, toolkitStackName) {
        toolkitStackName = toolkitStackName !== null && toolkitStackName !== void 0 ? toolkitStackName : toolkit_info_1.DEFAULT_TOOLKIT_STACK_NAME;
        const resolvedEnvironment = await sdkProvider.resolveEnvironment(environment);
        const sdk = await sdkProvider.forEnvironment(resolvedEnvironment, aws_auth_1.Mode.ForWriting);
        const currentToolkitInfo = await toolkit_info_1.ToolkitStackInfo.lookup(resolvedEnvironment, sdk, toolkitStackName);
        return new BootstrapStack(sdkProvider, sdk, resolvedEnvironment, toolkitStackName, currentToolkitInfo);
    }
    get parameters() {
        var _a, _b;
        return (_b = (_a = this.currentToolkitInfo) === null || _a === void 0 ? void 0 : _a.parameters) !== null && _b !== void 0 ? _b : {};
    }
    get terminationProtection() {
        var _a, _b;
        return (_b = (_a = this.currentToolkitInfo) === null || _a === void 0 ? void 0 : _a.stack) === null || _b === void 0 ? void 0 : _b.terminationProtection;
    }
    async partition() {
        return (await this.sdk.currentAccount()).partition;
    }
    /**
     * Perform the actual deployment of a bootstrap stack, given a template and some parameters
     */
    async update(template, parameters, options) {
        var _a;
        const newVersion = bootstrapVersionFromTemplate(template);
        if (this.currentToolkitInfo && newVersion < this.currentToolkitInfo.version && !options.force) {
            throw new Error(`Not downgrading existing bootstrap stack from version '${this.currentToolkitInfo.version}' to version '${newVersion}'. Use --force to force.`);
        }
        const outdir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdk-bootstrap'));
        const builder = new cxapi.CloudAssemblyBuilder(outdir);
        const templateFile = `${this.toolkitStackName}.template.json`;
        await fs.writeJson(path.join(builder.outdir, templateFile), template, { spaces: 2 });
        builder.addArtifact(this.toolkitStackName, {
            type: cxschema.ArtifactType.AWS_CLOUDFORMATION_STACK,
            environment: cxapi.EnvironmentUtils.format(this.resolvedEnvironment.account, this.resolvedEnvironment.region),
            properties: {
                templateFile,
                terminationProtection: (_a = options.terminationProtection) !== null && _a !== void 0 ? _a : false,
            },
        });
        const assembly = builder.buildAssembly();
        return deploy_stack_1.deployStack({
            stack: assembly.getStackByName(this.toolkitStackName),
            resolvedEnvironment: this.resolvedEnvironment,
            sdk: this.sdk,
            sdkProvider: this.sdkProvider,
            force: options.force,
            roleArn: options.roleArn,
            tags: options.tags,
            execute: options.execute,
            parameters,
            usePreviousParameters: true,
        });
    }
}
exports.BootstrapStack = BootstrapStack;
function bootstrapVersionFromTemplate(template) {
    var _a, _b, _c, _d, _e;
    const versionSources = [
        (_b = (_a = template.Outputs) === null || _a === void 0 ? void 0 : _a[bootstrap_props_1.BOOTSTRAP_VERSION_OUTPUT]) === null || _b === void 0 ? void 0 : _b.Value,
        (_e = (_d = (_c = template.Resources) === null || _c === void 0 ? void 0 : _c[bootstrap_props_1.BOOTSTRAP_VERSION_RESOURCE]) === null || _d === void 0 ? void 0 : _d.Properties) === null || _e === void 0 ? void 0 : _e.Value,
    ];
    for (const vs of versionSources) {
        if (typeof vs === 'number') {
            return vs;
        }
        if (typeof vs === 'string' && !isNaN(parseInt(vs, 10))) {
            return parseInt(vs, 10);
        }
    }
    return 0;
}
exports.bootstrapVersionFromTemplate = bootstrapVersionFromTemplate;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LWJvb3RzdHJhcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlcGxveS1ib290c3RyYXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QiwyREFBMkQ7QUFDM0QseUNBQXlDO0FBQ3pDLCtCQUErQjtBQUMvQiwwQ0FBc0Q7QUFDdEQsa0RBQWlFO0FBQ2pFLGtEQUErRTtBQUMvRSx1REFBc0g7QUFFdEg7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWtCRztBQUNILE1BQWEsY0FBYztJQVd6QixZQUNtQixXQUF3QixFQUN4QixHQUFTLEVBQ1QsbUJBQXNDLEVBQ3RDLGdCQUF3QixFQUN4QixrQkFBcUM7UUFKckMsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFDeEIsUUFBRyxHQUFILEdBQUcsQ0FBTTtRQUNULHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBbUI7UUFDdEMscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFRO1FBQ3hCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBbUI7SUFDeEQsQ0FBQztJQWhCTSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUF3QixFQUFFLFdBQThCLEVBQUUsZ0JBQXlCO1FBQzVHLGdCQUFnQixHQUFHLGdCQUFnQixhQUFoQixnQkFBZ0IsY0FBaEIsZ0JBQWdCLEdBQUkseUNBQTBCLENBQUM7UUFFbEUsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM5RSxNQUFNLEdBQUcsR0FBRyxNQUFNLFdBQVcsQ0FBQyxjQUFjLENBQUMsbUJBQW1CLEVBQUUsZUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ25GLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSwrQkFBZ0IsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFFckcsT0FBTyxJQUFJLGNBQWMsQ0FBQyxX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TywwQ0FBRywwQ0FBd0IsMkNBQUcsS0FBSzswQkFDbkQsUUFBUSxDQUFDLFNBQVMsMENBQUcsNENBQTBCLDJDQUFHLFVBQVUsMENBQUUsS0FBSztLQUNwRSxDQUFDO0lBRUYsS0FBSyxNQUFNLEVBQUUsSUFBSSxjQUFjLEVBQUU7UUFDL0IsSUFBSSxPQUFPLEVBQUUsS0FBSyxRQUFRLEVBQUU7WUFBRSxPQUFPLEVBQUUsQ0FBQztTQUFFO1FBQzFDLElBQUksT0FBTyxFQUFFLEtBQUssUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUN0RCxPQUFPLFFBQVEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7U0FDekI7S0FDRjtJQUNELE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQWJELG9FQWFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGN4c2NoZW1hIGZyb20gJ0Bhd3MtY2RrL2Nsb3VkLWFzc2VtYmx5LXNjaGVtYSc7XG5pbXBvcnQgKiBhcyBjeGFwaSBmcm9tICdAYXdzLWNkay9jeC1hcGknO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IHsgTW9kZSwgU2RrUHJvdmlkZXIsIElTREsgfSBmcm9tICcuLi9hd3MtYXV0aCc7XG5pbXBvcnQgeyBkZXBsb3lTdGFjaywgRGVwbG95U3RhY2tSZXN1bHQgfSBmcm9tICcuLi9kZXBsb3ktc3RhY2snO1xuaW1wb3J0IHsgREVGQVVMVF9UT09MS0lUX1NUQUNLX05BTUUsIFRvb2xraXRTdGFja0luZm8gfSBmcm9tICcuLi90b29sa2l0LWluZm8nO1xuaW1wb3J0IHsgQk9PVFNUUkFQX1ZFUlNJT05fT1VUUFVULCBCb290c3RyYXBFbnZpcm9ubWVudE9wdGlvbnMsIEJPT1RTVFJBUF9WRVJTSU9OX1JFU09VUkNFIH0gZnJvbSAnLi9ib290c3RyYXAtcHJvcHMnO1xuXG4vKipcbiAqIEEgY2xhc3MgdG8gaG9sZCBzdGF0ZSBhcm91bmQgc3RhY2sgYm9vdHN0cmFwcGluZ1xuICpcbiAqIFRoaXMgY2xhc3MgZXhpc3RzIHNvIHdlIGNhbiBicmVhayBib290c3RyYXBwaW5nIGludG8gMiBwaGFzZXM6XG4gKlxuICogYGBgdHNcbiAqIGNvbnN0IGN1cnJlbnQgPSBCb290c3RyYXBTdGFjay5sb29rdXAoLi4uKTtcbiAqIC8vIC4uLlxuICogY3VycmVudC51cGRhdGUobmV3VGVtcGxhdGUsIC4uLik7XG4gKiBgYGBcbiAqXG4gKiBBbmQgZG8gc29tZXRoaW5nIGluIGJldHdlZW4gdGhlIHR3byBwaGFzZXMgKHN1Y2ggYXMgbG9vayBhdCB0aGVcbiAqIGN1cnJlbnQgYm9vdHN0cmFwIHN0YWNrIGFuZCBkb2luZyBzb21ldGhpbmcgaW50ZWxsaWdlbnQpLlxuICpcbiAqIFRoaXMgY2xhc3MgaXMgZGlmZmVyZW50IGZyb20gYFRvb2xraXRJbmZvYCBpbiB0aGF0IGBUb29sa2l0SW5mb2BcbiAqIGlzIHB1cmVseSByZWFkLW9ubHksIGFuZCBgVG9vbGtpdEluZm8ubG9va3VwKClgIHJldHVybnMgYHVuZGVmaW5lZGBcbiAqIGlmIHRoZSBzdGFjayBkb2VzIG5vdCBleGlzdC4gQnV0IGhvbmVzdGx5LCB0aGVzZSBjbGFzc2VzIGNvdWxkIGFuZFxuICogc2hvdWxkIHByb2JhYmx5IGJlIG1lcmdlZCBhdCBzb21lIHBvaW50LlxuICovXG5leHBvcnQgY2xhc3MgQm9vdHN0cmFwU3RhY2sge1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIGxvb2t1cChzZGtQcm92aWRlcjogU2RrUHJvdmlkZXIsIGVudmlyb25tZW50OiBjeGFwaS5FbnZpcm9ubWVudCwgdG9vbGtpdFN0YWNrTmFtZT86IHN0cmluZykge1xuICAgIHRvb2xraXRTdGFja05hbWUgPSB0b29sa2l0U3RhY2tOYW1lID8/IERFRkFVTFRfVE9PTEtJVF9TVEFDS19OQU1FO1xuXG4gICAgY29uc3QgcmVzb2x2ZWRFbnZpcm9ubWVudCA9IGF3YWl0IHNka1Byb3ZpZGVyLnJlc29sdmVFbnZpcm9ubWVudChlbnZpcm9ubWVudCk7XG4gICAgY29uc3Qgc2RrID0gYXdhaXQgc2RrUHJvdmlkZXIuZm9yRW52aXJvbm1lbnQocmVzb2x2ZWRFbnZpcm9ubWVudCwgTW9kZS5Gb3JXcml0aW5nKTtcbiAgICBjb25zdCBjdXJyZW50VG9vbGtpdEluZm8gPSBhd2FpdCBUb29sa2l0U3RhY2tJbmZvLmxvb2t1cChyZXNvbHZlZEVudmlyb25tZW50LCBzZGssIHRvb2xraXRTdGFja05hbWUpO1xuXG4gICAgcmV0dXJuIG5ldyBCb290c3RyYXBTdGFjayhzZGtQcm92aWRlciwgc2RrLCByZXNvbHZlZEVudmlyb25tZW50LCB0b29sa2l0U3RhY2tOYW1lLCBjdXJyZW50VG9vbGtpdEluZm8pO1xuICB9XG5cbiAgcHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2RrUHJvdmlkZXI6IFNka1Byb3ZpZGVyLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2RrOiBJU0RLLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcmVzb2x2ZWRFbnZpcm9ubWVudDogY3hhcGkuRW52aXJvbm1lbnQsXG4gICAgcHJpdmF0ZSByZWFkb25seSB0b29sa2l0U3RhY2tOYW1lOiBzdHJpbmcsXG4gICAgcHJpdmF0ZSByZWFkb25seSBjdXJyZW50VG9vbGtpdEluZm8/OiBUb29sa2l0U3RhY2tJbmZvKSB7XG4gIH1cblxuICBwdWJsaWMgZ2V0IHBhcmFtZXRlcnMoKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRvb2xraXRJbmZvPy5wYXJhbWV0ZXJzID8/IHt9O1xuICB9XG5cbiAgcHVibGljIGdldCB0ZXJtaW5hdGlvblByb3RlY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRvb2xraXRJbmZvPy5zdGFjaz8udGVybWluYXRpb25Qcm90ZWN0aW9uO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIHBhcnRpdGlvbigpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5zZGsuY3VycmVudEFjY291bnQoKSkucGFydGl0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm0gdGhlIGFjdHVhbCBkZXBsb3ltZW50IG9mIGEgYm9vdHN0cmFwIHN0YWNrLCBnaXZlbiBhIHRlbXBsYXRlIGFuZCBzb21lIHBhcmFtZXRlcnNcbiAgICovXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUoXG4gICAgdGVtcGxhdGU6IGFueSxcbiAgICBwYXJhbWV0ZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCB1bmRlZmluZWQ+LFxuICAgIG9wdGlvbnM6IE9taXQ8Qm9vdHN0cmFwRW52aXJvbm1lbnRPcHRpb25zLCAncGFyYW1ldGVycyc+LFxuICApOiBQcm9taXNlPERlcGxveVN0YWNrUmVzdWx0PiB7XG5cbiAgICBjb25zdCBuZXdWZXJzaW9uID0gYm9vdHN0cmFwVmVyc2lvbkZyb21UZW1wbGF0ZSh0ZW1wbGF0ZSk7XG4gICAgaWYgKHRoaXMuY3VycmVudFRvb2xraXRJbmZvICYmIG5ld1ZlcnNpb24gPCB0aGlzLmN1cnJlbnRUb29sa2l0SW5mby52ZXJzaW9uICYmICFvcHRpb25zLmZvcmNlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vdCBkb3duZ3JhZGluZyBleGlzdGluZyBib290c3RyYXAgc3RhY2sgZnJvbSB2ZXJzaW9uICcke3RoaXMuY3VycmVudFRvb2xraXRJbmZvLnZlcnNpb259JyB0byB2ZXJzaW9uICcke25ld1ZlcnNpb259Jy4gVXNlIC0tZm9yY2UgdG8gZm9yY2UuYCk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0ZGlyID0gYXdhaXQgZnMubWtkdGVtcChwYXRoLmpvaW4ob3MudG1wZGlyKCksICdjZGstYm9vdHN0cmFwJykpO1xuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgY3hhcGkuQ2xvdWRBc3NlbWJseUJ1aWxkZXIob3V0ZGlyKTtcbiAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBgJHt0aGlzLnRvb2xraXRTdGFja05hbWV9LnRlbXBsYXRlLmpzb25gO1xuICAgIGF3YWl0IGZzLndyaXRlSnNvbihwYXRoLmpvaW4oYnVpbGRlci5vdXRkaXIsIHRlbXBsYXRlRmlsZSksIHRlbXBsYXRlLCB7IHNwYWNlczogMiB9KTtcblxuICAgIGJ1aWxkZXIuYWRkQXJ0aWZhY3QodGhpcy50b29sa2l0U3RhY2tOYW1lLCB7XG4gICAgICB0eXBlOiBjeHNjaGVtYS5BcnRpZmFjdFR5cGUuQVdTX0NMT1VERk9STUFUSU9OX1NUQUNLLFxuICAgICAgZW52aXJvbm1lbnQ6IGN4YXBpLkVudmlyb25tZW50VXRpbHMuZm9ybWF0KHRoaXMucmVzb2x2ZWRFbnZpcm9ubWVudC5hY2NvdW50LCB0aGlzLnJlc29sdmVkRW52aXJvbm1lbnQucmVnaW9uKSxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgdGVtcGxhdGVGaWxlLFxuICAgICAgICB0ZXJtaW5hdGlvblByb3RlY3Rpb246IG9wdGlvbnMudGVybWluYXRpb25Qcm90ZWN0aW9uID8/IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFzc2VtYmx5ID0gYnVpbGRlci5idWlsZEFzc2VtYmx5KCk7XG5cbiAgICByZXR1cm4gZGVwbG95U3RhY2soe1xuICAgICAgc3RhY2s6IGFzc2VtYmx5LmdldFN0YWNrQnlOYW1lKHRoaXMudG9vbGtpdFN0YWNrTmFtZSksXG4gICAgICByZXNvbHZlZEVudmlyb25tZW50OiB0aGlzLnJlc29sdmVkRW52aXJvbm1lbnQsXG4gICAgICBzZGs6IHRoaXMuc2RrLFxuICAgICAgc2RrUHJvdmlkZXI6IHRoaXMuc2RrUHJvdmlkZXIsXG4gICAgICBmb3JjZTogb3B0aW9ucy5mb3JjZSxcbiAgICAgIHJvbGVBcm46IG9wdGlvbnMucm9sZUFybixcbiAgICAgIHRhZ3M6IG9wdGlvbnMudGFncyxcbiAgICAgIGV4ZWN1dGU6IG9wdGlvbnMuZXhlY3V0ZSxcbiAgICAgIHBhcmFtZXRlcnMsXG4gICAgICB1c2VQcmV2aW91c1BhcmFtZXRlcnM6IHRydWUsXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJvb3RzdHJhcFZlcnNpb25Gcm9tVGVtcGxhdGUodGVtcGxhdGU6IGFueSk6IG51bWJlciB7XG4gIGNvbnN0IHZlcnNpb25Tb3VyY2VzID0gW1xuICAgIHRlbXBsYXRlLk91dHB1dHM/LltCT09UU1RSQVBfVkVSU0lPTl9PVVRQVVRdPy5WYWx1ZSxcbiAgICB0ZW1wbGF0ZS5SZXNvdXJjZXM/LltCT09UU1RSQVBfVkVSU0lPTl9SRVNPVVJDRV0/LlByb3BlcnRpZXM/LlZhbHVlLFxuICBdO1xuXG4gIGZvciAoY29uc3QgdnMgb2YgdmVyc2lvblNvdXJjZXMpIHtcbiAgICBpZiAodHlwZW9mIHZzID09PSAnbnVtYmVyJykgeyByZXR1cm4gdnM7IH1cbiAgICBpZiAodHlwZW9mIHZzID09PSAnc3RyaW5nJyAmJiAhaXNOYU4ocGFyc2VJbnQodnMsIDEwKSkpIHtcbiAgICAgIHJldHVybiBwYXJzZUludCh2cywgMTApO1xuICAgIH1cbiAgfVxuICByZXR1cm4gMDtcbn0iXX0=