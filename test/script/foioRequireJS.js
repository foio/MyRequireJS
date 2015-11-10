/*
*
* 本程序目的是演示javascript模块加载系统的结构，为了不至于使读者迷失在细节中，作者没考虑浏览器的兼容性，没有考虑参数的异常情况，作者只在chrome上测试通过
* blog: foio.github.io
* mail: syszhpe@gmail.com
* 积木村の研究所
* date: 2015年11月11日(似乎暴漏了什么)
*
*/

(function(global){
	/*
	*初始化2个基本数据结构
	* loadings:存放正在加载的模块id，加载完成后需要移除
	* modules:存放所有开始加载的模块信息，包括已经处理完成后的模块
	*/
	var  loadings = [], modules = {}; 

	/*
	* 用于检测循环依赖的颜色标记
	*/
	var colorbase = 1;

	/*
	* init函数初始化的2个系统变量
	* basepath: MyRequireJS的目录, basepath+模块名+'.js'为各个模块js文件路径	
	*/
	//MyRequireJS的目录, basepath+模块名+'.js'为各个模块js文件路径	
	//程序入口函数所在的js文件
	var basepath = '',  init = false;

	//MyRequireJS demo object by foio
	var foioRequireJS = {};

	//define函数的整体框架
	foioRequireJS.define = function(deps, callback){
		//根据模块名获取模块的url
		var id = foioRequireJS.getCurrentJs();
		//将依赖中的name转换为id，id其实是模块javascript文件的全路径
		var depsId = []; 
		deps.map(function(name){
			depsId.push(foioRequireJS.getScriptId(name));
		});
		//如果模块没有注册，就将模块加入modules列表
		if(!modules[id]){
				modules[id] = {
					id: id, 
					state: 1,//模块的加载状态	
					deps:depsId,//模块的依赖关系
					callback: callback,//模块的回调函数
					exports: null,//本模块回调函数callback的返回结果，供依赖于该模块的其他模块使用
					color: 0,
				};
		}
	};


	//require函数的整体框架
	foioRequireJS.require = function(deps,callback){
		//获取主模块的id
		id = foioRequireJS.getCurrentJs();

		//将主模块main注册到modules中
		if(!modules[id]){

			//将主模块main依赖中的name转换为id，id其实是模块的对应javascript文件的全路径
			var depsId = []; 
			deps.map(function(name){
				depsId.push(foioRequireJS.getScriptId(name));
			});

			//将主模块main注册到modules列表中
			modules[id]	 = {
				id: id, 
				state: 1,//模块的加载状态	
				deps:depsId,//模块的依赖关系
				callback: callback,//模块的回调函数
				exports: null,//本模块回调函数callback的返回结果，供依赖于该模块的其他模块使用
				color:0,
			};
			//这里为main入口函数，需要将它的id也加入loadings列表，以便触发回调
			loadings.unshift(id);						
		}
		//加载依赖模块
		foioRequireJS.loadDepsModule(id);
	}


	//用于递归地加载id模块的依赖模块
	foioRequireJS.loadDepsModule = function(id){
		//依次处理本模块的依赖关系
		modules[id].deps.map(function(el){
			//如果模块还没开始加载，则加载模块所在的js文件
			if(!modules[el]){
				foioRequireJS.loadJS(el,function(){
					//模块开始加载时，放入加载队列，以便检测加载情况
					loadings.unshift(el);						
					//递归的调用loadModule函数加载依赖模块
					foioRequireJS.loadDepsModule(el);
					//加载完成后执行依赖检查，如果依赖全部加载完成就执行callback函数
					foioRequireJS.checkDeps();	
				});
			}
		});
	}	


	//根据name获取js文件路径	
	foioRequireJS.getScriptId = function(name){
		if(!init){
			foioRequireJS.init();	
		}
		return basepath + name + '.js';
	}	

	//foioRequireJS初始化函数
	/*
	 * foioRequireJS的初始化函数，主要功能获取basepath
	 * 从而使得basepath+name+'.js'为各个模块js文件路径。
	 */
	foioRequireJS.init = function(){
		if(!init){
			var currentfile = foioRequireJS.getCurrentJs();
			//获取basepath
			basepath =  currentfile.replace(/[^\/]+\.js/i,'');
			//标志已经初始化
			init = true;
			//入口函数所在的js文件
			var nodes = document.getElementsByTagName("Script");
			var node = nodes[nodes.length - 1];	
			var mainjs = node.getAttribute('data-main'); 
			mainentry = mainjs;
			//首先加载入口js文件并执行
			foioRequireJS.loadJS(mainjs,null);
		}
	}	

	/*
	 *  这个api是chrome专用的，正如前面所说，我们不考虑浏览器兼容性
	 */
	foioRequireJS.getCurrentJs = function(){
		return document.currentScript.src;	
	}

	//foioRequireJS的js加载函数	
	foioRequireJS.loadJS = function(url,callback){
		//创建script节点
		var node = document.createElement("script");
		node.type="text/javascript";
		//监听脚本加载完成事件，针对符合W3C标准的浏览器监听onload事件即可
		node.onload = function(){
			if(callback){
				callback();
			}
		};
		//监听onerror事件处理javascript加载失败的情况
		node.onerror = function(){
			throw Error('load script:'+url+" failed!");	
		}
		node.src=url;
		//插入到head中
		var head = document.getElementsByTagName("head")[0];
		head.appendChild(node);
	}

	//用于检测循环依赖的情况
	//具体的算法是遍历过程中标记颜色，如果发现节点的颜色已经被标记过，肯定存在循环依赖
	foioRequireJS.checkCycle = function(deps,id,color){
		//检查id的所有依赖模块
        //如果模块已经加载完成则不可能存在循环依赖
		if(modules[id].state != 2){
		    for(var depid in deps){
		        //如果发现节点的颜色已经被标记过，肯定存在循环依赖
		        if(modules[deps[depid]]){
		        	if(modules[deps[depid]].color >= color){
						throw Error("circular dependency detected");
		        	}else if(modules[deps[depid]].color < color){
		        		modules[deps[depid]].color = color;
		        	}
		        	if(modules[deps[depid]].state != 2){
		        		foioRequireJS.checkCycle(modules[deps[depid]].deps,id,color);
		        	}
			    }
		    }
		}
	}

	//检测模块的依赖关系是否处理完毕，该函数在每一次js的onload事件都会触发一次
	foioRequireJS.checkDeps = function(){
		//遍历加载列表
		for(var i = loadings.length, id; id = loadings[--i];){
			var obj = modules[id], deps = obj.deps, allloaded = true;									
			//遍历每一个模块的加载
			foioRequireJS.checkCycle(deps,id,colorbase++);
			for(var key in deps){
				//如果存在未加载完的模块，则退出内层循环
				if(!modules[deps[key]] || modules[deps[key]].state !== 2){
					allloaded = false;
					break;
				}
			}

			//如果所有模块已经加载完成
			if(allloaded){
				loadings.splice(i,1); //从loadings列表中移除已经加载完成的模块							
				//执行模块的callback函数
				foioRequireJS.fireFactory(obj.id, obj.deps, obj.callback);
				//该模块执行完成后可能使其他模块也满足执行条件了，继续检查，直到没有模块满足allloaded条件
				foioRequireJS.checkDeps();
			}
		}		
	}	

	//fireFactory的工作是从各个依赖模块收集返回值，然后调用该模块的后调函数
	foioRequireJS.fireFactory = function(id,deps,callback){
		var params = [];
		//遍历id模块的依赖，为calllback准备参数
		for (var i = 0, d; d = deps[i++];) {
 			params.push(modules[d].exports);
		};
		//在context对象上调用callback方法
		var ret = callback.apply(global,params);	
		//记录模块的返回结果，本模块的返回结果可能作为依赖该模块的其他模块的回调函数的参数
		if(ret != void 0){
			modules[id].exports = ret;
		}
		modules[id].state = 2; //标志模块已经加载并执行完成
		return ret;
	}

	foioRequireJS.init();
	global.define = foioRequireJS.define;
	global.require = foioRequireJS.require;
})(window);
