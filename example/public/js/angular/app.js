'use strict';

//// Application

var app = angular.module('myApp', ['myApp.filters', 'myApp.services', 'myApp.directives']);


//// Controllers

function TodoListCtrl(Todo, $scope) {
  $scope.text = '';

  // Retrieve initial todos from server
  $scope.todos = Todo.query();


  $scope.create = function() {
    var todo = new Todo({text: $scope.text});
    todo.$create(function(u) {          // same as $save but more explicit
      $scope.todos.push(u);

      // clears input box
      $scope.text = "";
    });
  };


  $scope.updateItemDone = function(todo) {
    // Any properties to be passed as body goes into constructor
    var resource = new Todo({done: todo.done});
    // Arguments for URL, in this case :id, is first arg to function
    resource.$update({id: todo.id});
  };


  $scope.editItem = function(todo) {
    todo.editing = true;
  };

  $scope.updateItemText = function(todo) {
    var resource = new Todo({text: todo.text});
    todo.editing = false;
    resource.$update({id: todo.id});
  };


  $scope.remaining = function() {
    var result = 0;
    $scope.todos.forEach(function(todo) {
      if (!todo.done) result += 1;
    });
    return result;
  };


  $scope.deleteItem = function(todo) {
    var resource = new Todo();
    // remove locally
    $scope.todos = _.reject($scope.todos, function(t) { return t.id === todo.id; });
    // remove from server
    resource.$delete({id: todo.id});
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
      resource.$delete({id: todo.id});
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

