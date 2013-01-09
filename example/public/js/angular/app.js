'use strict';

//// Application

var app = angular.module('myApp', ['myApp.filters', 'myApp.services', 'myApp.directives']);


//// Controllers

function TodoListCtrl(Todo, $scope) {
  $scope.todo = {};

  // Retrieve from server
  $scope.todos = Todo.query();

  $scope.create = function() {
    var todo = new Todo($scope.todo);
    todo.$create(function(u) {          // same as $save but more explicit
      $scope.todos.push(u);

      // clears input box
      $scope.todo = {};
    });
  };

  $scope.update = function(model) {
    console.log(model);
    var todo = new Todo(model);
    todo.$update({id: model.id}, function(u) {
    });
  };

  $scope.remaining = function() {
    var result = 0;
    $scope.todos.forEach(function(todo) {
      if (!todo.done) result += 1;
    });
    return result;
  };


  $scope.completed = function() {
    return $scope.todos.length - $scope.remaining();
  };


  $scope.deleteCompleted = function() {
    var remove = _.filter($scope.todos, function(todo) {
      return todo.done;
    });

    $scope.todos = _.reject($scope.todos, function(todo) {
      return todo.done;
    });

    remove.forEach(function(todo) {
      var resource  = new Todo(todo);
      resource.$delete({id: todo.id}, function() {
      });
    });
  }
}
TodoListCtrl.$inject = ['Todo', '$scope'];


//// Directives

var directives = angular.module('myApp.directives', []);

directives.directive('onEnter', function($parse) {
  return function(scope, elm, attrs) {
    var keyupFn = $parse(attrs.onEnter);
    elm.bind('keyup', function(evt) {
      if (evt.which === 13) {
        //$apply makes sure that angular knows we're changing something
        scope.$apply(function() {
          keyupFn(scope);
        });
      }
    });
  };
});


//// Filters

var filters = angular.module('myApp.filters', []);

/**
 * Returns a text value if inputValue is truthy else an empty string.
 */
filters.filter('isTruthy', function() {
  return function(inputValue, text) {
    return !!inputValue ? text : '';
  }
});

//// Services

var services = angular.module('myApp.services', ['ngResource']);

/**
 * Connects to `mapper` todos RESTful resource on server.
 */
services.factory('Todo',
  ['$resource', '$http', function($resource, $http) {
    return $resource('/api/todos/:id', {}, {
      create: { method: 'POST' },
      update: { method: 'PUT' }
    });
  }]
);

