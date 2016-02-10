/// <reference path="../../../typings/tsd.d.ts" />
/// <reference path="../../../typings/vsts-task-lib/vsts-task-lib.d.ts" />

import * as tomcat from "../../../src/tasks/tomcatDeployment/tomcatDeployment";

import assert = require("assert");
import chai = require("chai");
import sinon = require("sinon");
import sinonChai = require("sinon-chai");
import tl = require("vsts-task-lib/task");

chai.should();
chai.use(sinonChai);

var tomcatUrl = "http://localhost:8080";
var username = "dummyusername";
var password = "dummypassword";
var warfile = "\\users\\dummyusername\\dummywarfile.war";
var context = "/dummycontext";
var serverVersion = "6.x";

function redirectTaskLibOutputFromConsole(): void {
    var stdoutmock = {
        write: function(message: string) {}
    };
    tl.setStdStream(stdoutmock);
    tl.setErrStream(stdoutmock);
}

describe("tomcat.deploy", (): void => {
    var sandbox;
    var deployWarFileStub;
    var getInputStub;
    
    beforeEach((): void => {
        sandbox = sinon.sandbox.create();
        deployWarFileStub = sandbox.stub(tomcat, "deployWarFile");
        getInputStub = sandbox.stub(tl, "getInput");
        redirectTaskLibOutputFromConsole();
    });
    
    afterEach((): void => {
        sandbox.restore();
    });
    
    it("should pass input to deployWarFile", (): void => {
        getInputStub.withArgs("tomcatUrl").returns(tomcatUrl);
        getInputStub.withArgs("username").returns(username);
        getInputStub.withArgs("password").returns(password);
        getInputStub.withArgs("warfile").returns(warfile);
        getInputStub.withArgs("context").returns(context);
        getInputStub.withArgs("serverVersion").returns(serverVersion);
            
        tomcat.deploy();
        
        deployWarFileStub.withArgs(tomcatUrl, username, password, warfile, context, serverVersion).should.have.been.calledOnce;
    });
});

describe("tomcat.deployWarFile", (): void => {
    var sandbox;
    var execStub;
    var whichStub;
    
    beforeEach((): void => {
        sandbox = sinon.sandbox.create();
        execStub = sandbox.stub(tl, "exec");
        whichStub = sandbox.stub(tl, "which");
        whichStub.returns("dummy");
    });
    
    afterEach((): void => {
        sandbox.restore();
    });
    
    it("should call curl with correct arguments", (): void => {
        tomcat.deployWarFile(tomcatUrl, username, password, warfile, context, serverVersion);
        
        execStub.withArgs(tomcat.getCurlPath(), tomcat.getCurlCmdForDeployingWar(username, password, warfile, tomcatUrl)).should.have.been.calledOnce;
    });
    
    it("should trim inputs before passing to curl", (): void => {
        tomcat.deployWarFile(" " + tomcatUrl + " ", " " + username + " ", password, " " + warfile + " ", " " + context + " ", " " + serverVersion + " ");
        
        execStub.withArgs(tomcat.getCurlPath(), tomcat.getCurlCmdForDeployingWar(username, password, warfile, tomcatUrl)).should.have.been.calledOnce;
    });
    
    it("should not trim password", (): void => {
        tomcat.deployWarFile(tomcatUrl, username, " " + password + " ", warfile, context, serverVersion);
        
        execStub.withArgs(tomcat.getCurlPath(), tomcat.getCurlCmdForDeployingWar(username, " " + password + " ", warfile, tomcatUrl)).should.have.been.calledOnce;
    });
});

describe("tomcat.getCurlCmdForDeployingWar", (): void => {
    it("should properly construct the curl cmd arg", (): void => {
        var arg = tomcat.getCurlCmdForDeployingWar("username", "password", "warfile", "http://url/warfile");
        
        /* tslint:disable:quotemark */
        assert.strictEqual(arg, '--stderr - -i --fail -u username:"password" -T "warfile" http://url/warfile');
        /* tslint:enable:quotemark */    
    });
});

describe("tomcat.getCurlPath", (): void => {
    var sandbox;
    var exitStub;
    
    beforeEach((): void => {
        sandbox = sinon.sandbox.create(); 
        exitStub = sandbox.stub(process, "exit");
    });
    
    afterEach((): void => {
        sandbox.restore();
    });
    
    it("should return curl path if exists", (): void => {
        var mockPath = "c:\\program files\\cURL\\bin\\curl.exe";
        var whichStub = sandbox.stub(tl, "which");        
        whichStub.returns(mockPath);
        
        var curlPath = tomcat.getCurlPath();
        
        assert.strictEqual(curlPath, mockPath);
    });
    
    it("should halt execution if curl doesnot exist", (): void => {
        var whichStub = sandbox.stub(tl, "which", (tool: string, check?: boolean): string => {
            whichStub.restore();
            return tl.which("NoToolShouldExistWithThisName.SoActualBehaviorOf-tl.which-likeCurlDoesnotExixst", true);
        });
        
        tomcat.getCurlPath();
        
        exitStub.should.have.been.calledOnce;
    });
});

describe("tomcat.getTargetUrlForDeployingWar", (): void => {
    var version6 = "6.x";
    var version7 = "7OrAbove";
    var sandbox;
    var errorStub;
    var exitStub;
    
    beforeEach((): void => {
        sandbox = sinon.sandbox.create();
        errorStub = sandbox.stub(tl, "error"); 
        exitStub = sandbox.stub(process, "exit");
    });
    
    afterEach((): void => {
        sandbox.restore();
    });
    
    it("should construct url for tomcat 6.x versions", (): void => {
        var targetUrl = tomcat.getTargetUrlForDeployingWar("http://localhost:8080", "java_demo.war", "/", version6);
        assert.strictEqual(targetUrl, "http://localhost:8080/manager/deploy?path=/java_demo&update=true");
    });
    
    it("should construct url for tomcat 7.0 and above versions", (): void => {
        var targetUrl = tomcat.getTargetUrlForDeployingWar("http://localhost:8080", "c:\\java_demo.war", "/", version7);
        assert.strictEqual(targetUrl, "http://localhost:8080/manager/text/deploy?path=/java_demo&update=true");
    });
    
    it("should work with windows path", (): void => {
        var warfileValues: string[] = ["c:\\windows\\java_demo.war", "c:\\\\windows\\\\java_demo.war", "c:\\\\windows\\\\java_demo"];
        warfileValues.forEach(function(warfile: string) {
            var targetUrl = tomcat.getTargetUrlForDeployingWar("http://localhost:8080", warfile, "/", version6);
            assert.strictEqual(targetUrl, "http://localhost:8080/manager/deploy?path=/java_demo&update=true");
        });
    });
        
    it("should work with linux path", (): void => {
        var warfileValues: string[] = ["/usr/bin/java_demo.war", "/usr/bin/java_demo"];
        warfileValues.forEach(function(warfile: string) {
            var targetUrl = tomcat.getTargetUrlForDeployingWar("http://localhost:8080", warfile, "/", version6);
            assert.strictEqual(targetUrl, "http://localhost:8080/manager/deploy?path=/java_demo&update=true");
        });
    });
    
    it("should use context instead of warfile when context is provided", (): void => {
        var targetUrl = tomcat.getTargetUrlForDeployingWar("http://localhost:8080", "usr/bin/java_demo.war", "/Demo", version7);
        assert.strictEqual(targetUrl, "http://localhost:8080/manager/text/deploy?path=/Demo&update=true");
    });
    
    it("should write error and halt execution when context does not start with '/'", (): void => {
        tomcat.getTargetUrlForDeployingWar("http://localhost:8080", "/usr/bin/java_demo.war", "context", version6);
        errorStub.withArgs("Invalid context. Context should start with '/'").should.have.been.calledOnce;
        exitStub.should.have.been.calledOnce;
    });
    
    it("should URL encode context", (): void => {
        var targetUrl = tomcat.getTargetUrlForDeployingWar("http://localhost:8080", "usr/bin/java_demo.war", "/Context/Value With-Space&SpecialChar", version7);
        assert.strictEqual(targetUrl, "http://localhost:8080/manager/text/deploy?path=/Context/Value%20With-Space%26SpecialChar&update=true");
    });
    
    it("should URL encode warfile", (): void => {
        var targetUrl = tomcat.getTargetUrlForDeployingWar("http://localhost:8080", "usr/bin/java_demo with-space&specialChar%.war", "/", version7);
        assert.strictEqual(targetUrl, "http://localhost:8080/manager/text/deploy?path=/java_demo%20with-space%26specialChar%25&update=true");
    });
});