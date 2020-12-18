"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloud_assembly_schema_1 = require("@aws-cdk/cloud-assembly-schema");
const mockfs = require("mock-fs");
const lib_1 = require("../lib");
beforeEach(() => {
    mockfs({
        '/simple/cdk.out/assets.json': JSON.stringify({
            version: cloud_assembly_schema_1.Manifest.version(),
            files: {
                asset1: {
                    type: 'file',
                    source: { path: 'S1' },
                    destinations: {
                        dest1: { bucketName: 'D1', objectKey: 'X' },
                        dest2: { bucketName: 'D2', objectKey: 'X' },
                    },
                },
            },
            dockerImages: {
                asset2: {
                    type: 'thing',
                    source: { directory: 'S2' },
                    destinations: {
                        dest1: { repositoryName: 'D3', imageTag: 'X' },
                        dest2: { repositoryName: 'D4', imageTag: 'X' },
                    },
                },
            },
        }),
    });
});
afterEach(() => {
    mockfs.restore();
});
test('Can list manifest', () => {
    const manifest = lib_1.AssetManifest.fromPath('/simple/cdk.out');
    expect(manifest.list().join('\n')).toEqual(`
asset1 file {\"path\":\"S1\"}
  ├ asset1:dest1 {\"bucketName\":\"D1\",\"objectKey\":\"X\"}
  └ asset1:dest2 {\"bucketName\":\"D2\",\"objectKey\":\"X\"}
asset2 docker-image {\"directory\":\"S2\"}
  ├ asset2:dest1 {\"repositoryName\":\"D3\",\"imageTag\":\"X\"}
  └ asset2:dest2 {\"repositoryName\":\"D4\",\"imageTag\":\"X\"}
`.trim());
});
test('.entries() iterates over all destinations', () => {
    const manifest = lib_1.AssetManifest.fromPath('/simple/cdk.out');
    expect(manifest.entries).toEqual([
        new lib_1.FileManifestEntry(new lib_1.DestinationIdentifier('asset1', 'dest1'), { path: 'S1' }, { bucketName: 'D1', objectKey: 'X' }),
        new lib_1.FileManifestEntry(new lib_1.DestinationIdentifier('asset1', 'dest2'), { path: 'S1' }, { bucketName: 'D2', objectKey: 'X' }),
        new lib_1.DockerImageManifestEntry(new lib_1.DestinationIdentifier('asset2', 'dest1'), { directory: 'S2' }, { repositoryName: 'D3', imageTag: 'X' }),
        new lib_1.DockerImageManifestEntry(new lib_1.DestinationIdentifier('asset2', 'dest2'), { directory: 'S2' }, { repositoryName: 'D4', imageTag: 'X' }),
    ]);
});
test('can select by asset ID', () => {
    const manifest = lib_1.AssetManifest.fromPath('/simple/cdk.out');
    const subset = manifest.select([lib_1.DestinationPattern.parse('asset2')]);
    expect(subset.entries.map(e => f(e.genericDestination, 'repositoryName'))).toEqual(['D3', 'D4']);
});
test('can select by asset ID + destination ID', () => {
    const manifest = lib_1.AssetManifest.fromPath('/simple/cdk.out');
    const subset = manifest.select([
        lib_1.DestinationPattern.parse('asset1:dest1'),
        lib_1.DestinationPattern.parse('asset2:dest2'),
    ]);
    expect(subset.entries.map(e => f(e.genericDestination, 'repositoryName', 'bucketName'))).toEqual(['D1', 'D4']);
});
test('can select by destination ID', () => {
    const manifest = lib_1.AssetManifest.fromPath('/simple/cdk.out');
    const subset = manifest.select([
        lib_1.DestinationPattern.parse(':dest1'),
    ]);
    expect(subset.entries.map(e => f(e.genericDestination, 'repositoryName', 'bucketName'))).toEqual(['D1', 'D3']);
});
test('empty string is not a valid pattern', () => {
    expect(() => {
        lib_1.DestinationPattern.parse('');
    }).toThrow(/Empty string is not a valid destination identifier/);
});
test('pattern must have two components', () => {
    expect(() => {
        lib_1.DestinationPattern.parse('a:b:c');
    }).toThrow(/Asset identifier must contain at most 2/);
});
test('parse ASSET:* the same as ASSET and ASSET:', () => {
    expect(lib_1.DestinationPattern.parse('a:*')).toEqual(lib_1.DestinationPattern.parse('a'));
    expect(lib_1.DestinationPattern.parse('a:*')).toEqual(lib_1.DestinationPattern.parse('a:'));
});
test('parse *:DEST the same as :DEST', () => {
    expect(lib_1.DestinationPattern.parse('*:a')).toEqual(lib_1.DestinationPattern.parse(':a'));
});
function f(obj, ...keys) {
    for (const k of keys) {
        if (typeof obj === 'object' && obj !== null && k in obj) {
            return obj[k];
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuaWZlc3QudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1hbmlmZXN0LnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwwRUFBMEQ7QUFDMUQsa0NBQWtDO0FBQ2xDLGdDQUErSDtBQUUvSCxVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2QsTUFBTSxDQUFDO1FBQ0wsNkJBQTZCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUM1QyxPQUFPLEVBQUUsZ0NBQVEsQ0FBQyxPQUFPLEVBQUU7WUFDM0IsS0FBSyxFQUFFO2dCQUNMLE1BQU0sRUFBRTtvQkFDTixJQUFJLEVBQUUsTUFBTTtvQkFDWixNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO29CQUN0QixZQUFZLEVBQUU7d0JBQ1osS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFO3dCQUMzQyxLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUU7cUJBQzVDO2lCQUNGO2FBQ0Y7WUFDRCxZQUFZLEVBQUU7Z0JBQ1osTUFBTSxFQUFFO29CQUNOLElBQUksRUFBRSxPQUFPO29CQUNiLE1BQU0sRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUU7b0JBQzNCLFlBQVksRUFBRTt3QkFDWixLQUFLLEVBQUUsRUFBRSxjQUFjLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUU7d0JBQzlDLEtBQUssRUFBRSxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRTtxQkFDL0M7aUJBQ0Y7YUFDRjtTQUNGLENBQUM7S0FDSCxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQztBQUVILFNBQVMsQ0FBQyxHQUFHLEVBQUU7SUFDYixNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbkIsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENB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a0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsd0JBQWtCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDbEYsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENBQUMsZ0NBQWdDLEVBQUUsR0FBRyxFQUFFO0lBQzFDLE1BQU0sQ0FBQyx3QkFBa0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsd0JBQWtCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDbEYsQ0FBQyxDQUFDLENBQUM7QUFFSCxTQUFTLENBQUMsQ0FBQyxHQUFZLEVBQUUsR0FBRyxJQUFjO0lBQ3hDLEtBQUssTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFO1FBQ3BCLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLEdBQUcsS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRTtZQUN2RCxPQUFRLEdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUN4QjtLQUNGO0lBQ0QsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE1hbmlmZXN0IH0gZnJvbSAnQGF3cy1jZGsvY2xvdWQtYXNzZW1ibHktc2NoZW1hJztcbmltcG9ydCAqIGFzIG1vY2tmcyBmcm9tICdtb2NrLWZzJztcbmltcG9ydCB7IEFzc2V0TWFuaWZlc3QsIERlc3RpbmF0aW9uSWRlbnRpZmllciwgRGVzdGluYXRpb25QYXR0ZXJuLCBEb2NrZXJJbWFnZU1hbmlmZXN0RW50cnksIEZpbGVNYW5pZmVzdEVudHJ5IH0gZnJvbSAnLi4vbGliJztcblxuYmVmb3JlRWFjaCgoKSA9PiB7XG4gIG1vY2tmcyh7XG4gICAgJy9zaW1wbGUvY2RrLm91dC9hc3NldHMuanNvbic6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIHZlcnNpb246IE1hbmlmZXN0LnZlcnNpb24oKSxcbiAgICAgIGZpbGVzOiB7XG4gICAgICAgIGFzc2V0MToge1xuICAgICAgICAgIHR5cGU6ICdmaWxlJyxcbiAgICAgICAgICBzb3VyY2U6IHsgcGF0aDogJ1MxJyB9LFxuICAgICAgICAgIGRlc3RpbmF0aW9uczoge1xuICAgICAgICAgICAgZGVzdDE6IHsgYnVja2V0TmFtZTogJ0QxJywgb2JqZWN0S2V5OiAnWCcgfSxcbiAgICAgICAgICAgIGRlc3QyOiB7IGJ1Y2tldE5hbWU6ICdEMicsIG9iamVjdEtleTogJ1gnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBkb2NrZXJJbWFnZXM6IHtcbiAgICAgICAgYXNzZXQyOiB7XG4gICAgICAgICAgdHlwZTogJ3RoaW5nJyxcbiAgICAgICAgICBzb3VyY2U6IHsgZGlyZWN0b3J5OiAnUzInIH0sXG4gICAgICAgICAgZGVzdGluYXRpb25zOiB7XG4gICAgICAgICAgICBkZXN0MTogeyByZXBvc2l0b3J5TmFtZTogJ0QzJywgaW1hZ2VUYWc6ICdYJyB9LFxuICAgICAgICAgICAgZGVzdDI6IHsgcmVwb3NpdG9yeU5hbWU6ICdENCcsIGltYWdlVGFnOiAnWCcgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KSxcbiAgfSk7XG59KTtcblxuYWZ0ZXJFYWNoKCgpID0+IHtcbiAgbW9ja2ZzLnJlc3RvcmUoKTtcbn0pO1xuXG50ZXN0KCdDYW4gbGlzdCBtYW5pZmVzdCcsICgpID0+IHtcbiAgY29uc3QgbWFuaWZlc3QgPSBBc3NldE1hbmlmZXN0LmZyb21QYXRoKCcvc2ltcGxlL2Nkay5vdXQnKTtcbiAgZXhwZWN0KG1hbmlmZXN0Lmxpc3QoKS5qb2luKCdcXG4nKSkudG9FcXVhbChgXG5hc3NldDEgZmlsZSB7XFxcInBhdGhcXFwiOlxcXCJTMVxcXCJ9XG4gIOKUnCBhc3NldDE6ZGVzdDEge1xcXCJidWNrZXROYW1lXFxcIjpcXFwiRDFcXFwiLFxcXCJvYmplY3RLZXlcXFwiOlxcXCJYXFxcIn1cbiAg4pSUIGFzc2V0MTpkZXN0MiB7XFxcImJ1Y2tldE5hbWVcXFwiOlxcXCJEMlxcXCIsXFxcIm9iamVjdEtleVxcXCI6XFxcIlhcXFwifVxuYXNzZXQyIGRvY2tlci1pbWFnZSB7XFxcImRpcmVjdG9yeVxcXCI6XFxcIlMyXFxcIn1cbiAg4pScIGFzc2V0MjpkZXN0MSB7XFxcInJlcG9zaXRvcnlOYW1lXFxcIjpcXFwiRDNcXFwiLFxcXCJpbWFnZVRhZ1xcXCI6XFxcIlhcXFwifVxuICDilJQgYXNzZXQyOmRlc3QyIHtcXFwicmVwb3NpdG9yeU5hbWVcXFwiOlxcXCJENFxcXCIsXFxcImltYWdlVGFnXFxcIjpcXFwiWFxcXCJ9XG5gLnRyaW0oKSk7XG59KTtcblxudGVzdCgnLmVudHJpZXMoKSBpdGVyYXRlcyBvdmVyIGFsbCBkZXN0aW5hdGlvbnMnLCAoKSA9PiB7XG4gIGNvbnN0IG1hbmlmZXN0ID0gQXNzZXRNYW5pZmVzdC5mcm9tUGF0aCgnL3NpbXBsZS9jZGsub3V0Jyk7XG5cbiAgZXhwZWN0KG1hbmlmZXN0LmVudHJpZXMpLnRvRXF1YWwoW1xuICAgIG5ldyBGaWxlTWFuaWZlc3RFbnRyeShuZXcgRGVzdGluYXRpb25JZGVudGlmaWVyKCdhc3NldDEnLCAnZGVzdDEnKSwgeyBwYXRoOiAnUzEnIH0sIHsgYnVja2V0TmFtZTogJ0QxJywgb2JqZWN0S2V5OiAnWCcgfSksXG4gICAgbmV3IEZpbGVNYW5pZmVzdEVudHJ5KG5ldyBEZXN0aW5hdGlvbklkZW50aWZpZXIoJ2Fzc2V0MScsICdkZXN0MicpLCB7IHBhdGg6ICdTMScgfSwgeyBidWNrZXROYW1lOiAnRDInLCBvYmplY3RLZXk6ICdYJyB9KSxcbiAgICBuZXcgRG9ja2VySW1hZ2VNYW5pZmVzdEVudHJ5KG5ldyBEZXN0aW5hdGlvbklkZW50aWZpZXIoJ2Fzc2V0MicsICdkZXN0MScpLCB7IGRpcmVjdG9yeTogJ1MyJyB9LCB7IHJlcG9zaXRvcnlOYW1lOiAnRDMnLCBpbWFnZVRhZzogJ1gnIH0pLFxuICAgIG5ldyBEb2NrZXJJbWFnZU1hbmlmZXN0RW50cnkobmV3IERlc3RpbmF0aW9uSWRlbnRpZmllcignYXNzZXQyJywgJ2Rlc3QyJyksIHsgZGlyZWN0b3J5OiAnUzInIH0sIHsgcmVwb3NpdG9yeU5hbWU6ICdENCcsIGltYWdlVGFnOiAnWCcgfSksXG4gIF0pO1xufSk7XG5cbnRlc3QoJ2NhbiBzZWxlY3QgYnkgYXNzZXQgSUQnLCAoKSA9PiB7XG4gIGNvbnN0IG1hbmlmZXN0ID0gQXNzZXRNYW5pZmVzdC5mcm9tUGF0aCgnL3NpbXBsZS9jZGsub3V0Jyk7XG5cbiAgY29uc3Qgc3Vic2V0ID0gbWFuaWZlc3Quc2VsZWN0KFtEZXN0aW5hdGlvblBhdHRlcm4ucGFyc2UoJ2Fzc2V0MicpXSk7XG5cbiAgZXhwZWN0KHN1YnNldC5lbnRyaWVzLm1hcChlID0+IGYoZS5nZW5lcmljRGVzdGluYXRpb24sICdyZXBvc2l0b3J5TmFtZScpKSkudG9FcXVhbChbJ0QzJywgJ0Q0J10pO1xufSk7XG5cbnRlc3QoJ2NhbiBzZWxlY3QgYnkgYXNzZXQgSUQgKyBkZXN0aW5hdGlvbiBJRCcsICgpID0+IHtcbiAgY29uc3QgbWFuaWZlc3QgPSBBc3NldE1hbmlmZXN0LmZyb21QYXRoKCcvc2ltcGxlL2Nkay5vdXQnKTtcblxuICBjb25zdCBzdWJzZXQgPSBtYW5pZmVzdC5zZWxlY3QoW1xuICAgIERlc3RpbmF0aW9uUGF0dGVybi5wYXJzZSgnYXNzZXQxOmRlc3QxJyksXG4gICAgRGVzdGluYXRpb25QYXR0ZXJuLnBhcnNlKCdhc3NldDI6ZGVzdDInKSxcbiAgXSk7XG5cbiAgZXhwZWN0KHN1YnNldC5lbnRyaWVzLm1hcChlID0+IGYoZS5nZW5lcmljRGVzdGluYXRpb24sICdyZXBvc2l0b3J5TmFtZScsICdidWNrZXROYW1lJykpKS50b0VxdWFsKFsnRDEnLCAnRDQnXSk7XG59KTtcblxudGVzdCgnY2FuIHNlbGVjdCBieSBkZXN0aW5hdGlvbiBJRCcsICgpID0+IHtcbiAgY29uc3QgbWFuaWZlc3QgPSBBc3NldE1hbmlmZXN0LmZyb21QYXRoKCcvc2ltcGxlL2Nkay5vdXQnKTtcblxuICBjb25zdCBzdWJzZXQgPSBtYW5pZmVzdC5zZWxlY3QoW1xuICAgIERlc3RpbmF0aW9uUGF0dGVybi5wYXJzZSgnOmRlc3QxJyksXG4gIF0pO1xuXG4gIGV4cGVjdChzdWJzZXQuZW50cmllcy5tYXAoZSA9PiBmKGUuZ2VuZXJpY0Rlc3RpbmF0aW9uLCAncmVwb3NpdG9yeU5hbWUnLCAnYnVja2V0TmFtZScpKSkudG9FcXVhbChbJ0QxJywgJ0QzJ10pO1xufSk7XG5cbnRlc3QoJ2VtcHR5IHN0cmluZyBpcyBub3QgYSB2YWxpZCBwYXR0ZXJuJywgKCkgPT4ge1xuICBleHBlY3QoKCkgPT4ge1xuICAgIERlc3RpbmF0aW9uUGF0dGVybi5wYXJzZSgnJyk7XG4gIH0pLnRvVGhyb3coL0VtcHR5IHN0cmluZyBpcyBub3QgYSB2YWxpZCBkZXN0aW5hdGlvbiBpZGVudGlmaWVyLyk7XG59KTtcblxudGVzdCgncGF0dGVybiBtdXN0IGhhdmUgdHdvIGNvbXBvbmVudHMnLCAoKSA9PiB7XG4gIGV4cGVjdCgoKSA9PiB7XG4gICAgRGVzdGluYXRpb25QYXR0ZXJuLnBhcnNlKCdhOmI6YycpO1xuICB9KS50b1Rocm93KC9Bc3NldCBpZGVudGlmaWVyIG11c3QgY29udGFpbiBhdCBtb3N0IDIvKTtcbn0pO1xuXG50ZXN0KCdwYXJzZSBBU1NFVDoqIHRoZSBzYW1lIGFzIEFTU0VUIGFuZCBBU1NFVDonLCAoKSA9PiB7XG4gIGV4cGVjdChEZXN0aW5hdGlvblBhdHRlcm4ucGFyc2UoJ2E6KicpKS50b0VxdWFsKERlc3RpbmF0aW9uUGF0dGVybi5wYXJzZSgnYScpKTtcbiAgZXhwZWN0KERlc3RpbmF0aW9uUGF0dGVybi5wYXJzZSgnYToqJykpLnRvRXF1YWwoRGVzdGluYXRpb25QYXR0ZXJuLnBhcnNlKCdhOicpKTtcbn0pO1xuXG50ZXN0KCdwYXJzZSAqOkRFU1QgdGhlIHNhbWUgYXMgOkRFU1QnLCAoKSA9PiB7XG4gIGV4cGVjdChEZXN0aW5hdGlvblBhdHRlcm4ucGFyc2UoJyo6YScpKS50b0VxdWFsKERlc3RpbmF0aW9uUGF0dGVybi5wYXJzZSgnOmEnKSk7XG59KTtcblxuZnVuY3Rpb24gZihvYmo6IHVua25vd24sIC4uLmtleXM6IHN0cmluZ1tdKTogYW55IHtcbiAgZm9yIChjb25zdCBrIG9mIGtleXMpIHtcbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgb2JqICE9PSBudWxsICYmIGsgaW4gb2JqKSB7XG4gICAgICByZXR1cm4gKG9iaiBhcyBhbnkpW2tdO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIl19