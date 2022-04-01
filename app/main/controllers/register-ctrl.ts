import angular = require("angular");

angular
    .module("main")
    .controller("RegisterCtrl", function(
        $log,
        $state,
        Config,
        User,
        UIService,
        $cordovaInAppBrowser
    ) {
        const vm = this;
        $log.log("[RegisterCtrl] Initializing :", vm);
        $log.log(Config);

        const browserOptions = {
            location: "yes",
            clearcache: "yes",
            toolbar: "yes"
        };

        vm.name = Config.ENV.NAME;
        vm.version = Config.BUILD.VERSION;
        vm.passreset = false;

        // if the user is already authenticated, then redirect it to the main view
        if (User.isAuthenticated()) {
            $state.go("main.home");
        }

        // set the form user values to null
        vm.user = {
            username: "",
            email: "",
            password1: "",
            password2: ""
        };

        vm.onLogin = function() {
            $state.go("login");
        };

        vm.onPrivacy = function() {
            $cordovaInAppBrowser
                .open("https://iotile.cloud/privacy/", "_blank", browserOptions)
                .then(function() {
                    // success
                })
                .catch(function() {
                    vm.error = "Unable to open browser";
                });
        };

        vm.onTerms = function() {
            $cordovaInAppBrowser
                .open(
                    "https://iotile.cloud/sw-terms/",
                    "_blank",
                    browserOptions
                )
                .then(function() {
                    // success
                })
                .catch(function() {
                    vm.error = "Unable to open browser";
                });
        };

        vm.onRegister = function(registerForm) {
            function registerSuccessFn() {
                $log.log("[RegisterCtrl] Register successful");
                vm.passreset = false;

                vm.user = {
                    username: "",
                    name: "",
                    email: "",
                    password1: "",
                    password2: ""
                };
                vm.error = null;

                UIService.messageBox(
                    "Registration",
                    "We have sent an e-mail to you for verification. Follow the link provided to finalize the signup process. After verifying your email, you can come back to the App to login."
                );

                $state.go("login");
            }

            function registerErrorFn(error) {
                vm.passreset = true;
                $log.log("[RegisterCtrl] Registration failed");
                $log.log("ERROR IS: ", JSON.stringify(error));
            }

            if (registerForm.$valid) {
                if (vm.user.password1 !== vm.user.password2) {
                    vm.error = "Make sure passwords match";
                } else {
                    User.register(
                        vm.user.username,
                        vm.user.name,
                        vm.user.email,
                        vm.user.password1,
                        vm.user.password2
                    ).then(registerSuccessFn, registerErrorFn);
                }
            }
        };
    });
