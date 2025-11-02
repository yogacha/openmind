const fs = require('fs');
const path = require('path');
const { World, Workspace } = require('../model.js');

// Test colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

function assertEqual(actual, expected, testName) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        log(`✓ ${testName}`, 'green');
        return true;
    } else {
        log(`✗ ${testName}`, 'red');
        log(`  Expected: ${JSON.stringify(expected, null, 2)}`, 'yellow');
        log(`  Actual: ${JSON.stringify(actual, null, 2)}`, 'yellow');
        return false;
    }
}

function assertTrue(condition, testName) {
    if (condition) {
        log(`✓ ${testName}`, 'green');
        return true;
    } else {
        log(`✗ ${testName}`, 'red');
        return false;
    }
}

async function runTests() {
    log('=== Testing World and Workspace JSON Serialization ===', 'bold');

    let passedTests = 0;
    let totalTests = 0;

    try {
        // Load test data (adjust path for new location)
        const worldJsonPath = path.join(__dirname, '..', 'test-workspace', 'hello.world.json');
        const workspaceJsonPath = path.join(__dirname, '..', 'test-workspace', 'example.workspace.json');

        log('\n📁 Loading JSON files...', 'blue');
        const worldJsonData = JSON.parse(fs.readFileSync(worldJsonPath, 'utf8'));
        const workspaceJsonData = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf8'));

        log(`Loaded world.json with ${worldJsonData.items.length} items and ${worldJsonData.projections.length} projections`);
        log(`Loaded workspace1.json with ${workspaceJsonData.lights.length} lights and ${workspaceJsonData.items.length} items`);

        // Test World
        log('\n🌍 Testing `World` ...', 'blue');

        // Test `World.fromObject`
        totalTests++;
        const world = World.fromObject(worldJsonData);
        assertTrue(world instanceof World, 'World.fromObject creates World instance');
        if (world instanceof World) passedTests++;

        // Test `World.toObject`
        totalTests++;
        const worldBackToJson = world.toObject();
        assertEqual(worldBackToJson, worldJsonData, 'World.toObject preserves original data');
        if (JSON.stringify(worldBackToJson) === JSON.stringify(worldJsonData)) passedTests++;

        // Test `Workspace.fromObject`
        log('\n🏢 Testing `Workspace` ...', 'blue');

        totalTests++;
        const workspace = Workspace.fromObject(workspaceJsonData);
        assertTrue(workspace instanceof Workspace, 'Workspace.fromObject creates Workspace instance');
        if (workspace instanceof Workspace) passedTests++;

        // Test `Workspace.toObject`
        totalTests++;
        const workspaceBackToJson = workspace.toObject();
        assertEqual(workspaceBackToJson, workspaceJsonData, 'Workspace.toObject match original data');
        if (JSON.stringify(workspaceBackToJson) === JSON.stringify(workspaceJsonData)) passedTests++;

        // Final results
        log('\n📊 Test Results:', 'bold');
        log(`Passed: ${passedTests}/${totalTests} tests`);

        if (passedTests === totalTests) {
            log('🎉 All tests passed!', 'green');
            return true;
        } else {
            log(`❌ ${totalTests - passedTests} tests failed`, 'red');
            return false;
        }

    } catch (error) {
        log(`💥 Test execution failed: ${error.message}`, 'red');
        console.error(error);
        return false;
    }
}

// Run the tests
if (require.main === module) {
    runTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { runTests };