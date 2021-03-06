/**
 * Created by Ben on 08/06/2017.
 */

'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs-extra'));
const pm2 = Promise.promisifyAll(require('pm2'));
const ora = require('ora');
const path = require('path');

const ROOTPATH = process.cwd();
const sentinelFileConfig = ROOTPATH + "/.sentinel.config.json";


let printSentinel = function(){
    console.log("\n" +
        "   _____            _   _            _       _  _____ \n" +
        "  / ____|          | | (_)          | |     | |/ ____|\n" +
        " | (___   ___ _ __ | |_ _ _ __   ___| |     | | (___  \n" +
        "  \\___ \\ / _ \\ '_ \\| __| | '_ \\ / _ \\ | _   | |\\___ \\ \n" +
        "  ____) |  __/ | | | |_| | | | |  __/ || |__| |____) |\n" +
        " |_____/ \\___|_| |_|\\__|_|_| |_|\\___|_(_)____/|_____/ \n" +
        "                                                      \n" +
        "                                                      \n");
};


let server = {
    start: function(debug, config, clusters){
        let spinner = ora('Initializing...').start();
        printSentinel();
        let args = [];
        if (debug){
            args.push("--debug");
        }
        if (config){
            args.push("--config");
            args.push(config);
        }

        var localConfig;

        if (config){
            localConfig = require(`${ROOTPATH}/${config}`);
        }else{
            localConfig = require(`${process.cwd()}/config`);
        }

        let _conf = null;

        if (!debug) {
            _conf = localConfig.production;
        }else{
            _conf = localConfig.development;
            _conf.debug = true;
        }

        let appName =  _conf.appName || 'sentinel';
        let toSave = {appName: appName};

        fs.writeFile(sentinelFileConfig, JSON.stringify(toSave), function(err) {
            if (err){
                throw err;
            }


            let execMode = clusters && clusters > 1 ? 'cluster' : null;
            return fs.emptyDirAsync(path.join(ROOTPATH, './logs')).then(() => {
                return pm2.connectAsync().then(() => {
                    return pm2.startAsync({
                        name: appName,
                        script: `${__dirname}/index.js`,
                        cwd: ROOTPATH,
                        args: args,
                        execMode: execMode,
                        instances: clusters,
                        output: path.join(ROOTPATH, './logs/sentinel-output.log'),
                        error: path.join(ROOTPATH, './logs/sentinel-error.log'),
                        minUptime: 5000,
                        maxRestarts: 5
                    }).then((res) => {
                        spinner.succeed(`${appName} has started successfully.`);
                    }).catch((err)=>{
                        spinner.fail(err);
                        process.exit(1);
                    }).finally(() => {
                        pm2.disconnect();
                    })
                }).catch((err)=>{
                    spinner.fail(err);
                    process.exit(1);
                })
            }).catch(err => {
                spinner.fail(err);
                process.exit(1);
            });

        });

    },
    stop: function(){

        let appName = JSON.parse(fs.readFileSync(sentinelFileConfig)).appName;

        let spinner = ora(`Shutting down ${appName}`).start();
        return pm2.connectAsync().then(() => {
            return pm2.stopAsync(appName).then(() => {
                spinner.succeed(`${appName} has stopped successfully.`);
            }).finally(() => {
                pm2.disconnect();
            })
        }).catch(err => {
            spinner.fail(err);
            process.exit(1);
        })
    },
    restart: function(){
        let appName = JSON.parse(fs.readFileSync(sentinelFileConfig)).appName;

        let spinner = ora(`Restarting [${appName}]`).start();
        return pm2.connectAsync().then(() => {
            pm2.gracefulReloadAsync(appName).then(()=>{
                spinner.succeed(`${appName} has restarted successfully.`);
            }).catch((err)=>{
                spinner.fail(err);
                process.exit(1);
            }).finally(() => {
                pm2.disconnect();
            });
        }).catch((err)=>{
            spinner.fail(err);
            process.exit(1);
        })
    },
    delete: function() {
        let appName = JSON.parse(fs.readFileSync(sentinelFileConfig)).appName;

        let spinner = ora(`Removing [${appName}]`).start();
        return pm2.connectAsync().then(() => {
            pm2.deleteAsync(appName).then(() => {
                spinner.succeed(`${appName} has been removed successfully.`);
            }).catch((err) => {
                spinner.fail(err);
                process.exit(1);
            }).finally(() => {
                pm2.disconnect();
            });
        }).catch((err) => {
            spinner.fail(err);
            process.exit(1);
        })
    },
    status: function() {
        let appName = JSON.parse(fs.readFileSync(sentinelFileConfig)).appName;

        let spinner = ora(`Verifying ${appName}...`).start();
        return pm2.connectAsync().then(() => {
            pm2.describeAsync(appName).then((result) => {
                if (result.length > 0){
                    spinner.succeed(`${result[0].name} => CPU ${result[0].monit.cpu}% | ${(result[0].monit.memory / 1048576).toFixed(2)}MB used`);
                }else{
                    spinner.succeed("Nothing to show yet");
                }
            }).catch((err) => {
                spinner.fail(err);
                process.exit(1);
            }).finally(() => {
                pm2.disconnect();
            });
        }).catch((err) => {
            spinner.fail(err);
            process.exit(1);
        })
    },
    log: function() {
        let appName = JSON.parse(fs.readFileSync(sentinelFileConfig)).appName;

        let spinner = ora(`Watching ${appName}, CTRL+C to exit`).start();
        return pm2.connectAsync().then(() => {
            pm2.streamLogs(appName);

        }).catch((err) => {
            spinner.fail(err);
            process.exit(1);
        })
    },
    helloWorld: function(){
        printSentinel();
        let spinner = ora('Working on it yet.').start();
        console.log("\n¯\\_(ツ)_/¯");
        spinner.fail('Sentinel.js not ready for hello-world yet.');
        process.exit();
    }
};
module.exports = server;
