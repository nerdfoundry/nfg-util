# nfg-util

Utilities, scripts, and library for NFG-based projects.

## Running/Building

For Active Development:

```sh
docker-compose -f ./docker-compose.yml -f ./docker-compose.dev.yml up
```

For a Development bundle:

```sh
docker-compose -f ./docker-compose.yml -f ./docker-compose.dev-build.yml up
```

For a Production bundle:

```sh
docker-compose -f ./docker-compose.yml -f ./docker-compose.prod.yml up
```

### Adding Dependencies

While running in `Active Development` mode, simply exec `npm` or attach into the running container:

```sh
docker exec -it nfg-util npm i -D someutil

#or

docker exec -it nfg-util ash # You're now in a shell!
```

## Files

| Path          | Description                                |
| ------------- | ------------------------------------------ |
| tsconfig.json | Base `tsconfig.json` for all NFG projects. |

## Namespaces

| Namespace | Description                                                            |
| --------- | ---------------------------------------------------------------------- |
| build     | Build toolchain code.                                                  |
| core      | Core/Common Utility functions that are effectively namespace-agnostic. |
| plugin    | ESM-based Plugin Architecture.                                         |



### Plugin Dependency Resolution

Plugins can be either really simple, or entirely too complex. But that's up to you.

Here we'll talk about the approach to dependency resolution, to help demonstrate the flexibility, as well as the potential fallbacks that a developer might run into if they're not careful.

This process takes place across a single collection of [`Manifest`]()s describing their `Behavior`s and their `Accessors` via `*Names`. Each isolated dependency tree is treated *atomically*, meaning if any one plugin in said-tree fails then the entire tree fails. A collection of `Manifest`s can potentially have multiple dependency trees, so this doesn't mean the entire ecosystem fails!

#### Relation Scenarios

With the flexible nature of the Plugin architecture and [Manifest]() configuration, we're able to have anything from extremely simple to highly complex node graphs for a dependency tree.

It should resolve as you'd expect compared to most dependency systems - self and cyclical references are *not allowed* and caught.

However, what makes this Plugin framework unique is the ability to reference a collection of Plugins by a more generic `BehaviorName` instead of an explicit versioned `PluginName`.

> In all scenarios given, `Plugin1` through `Plugin4` are top-level as shown in the `No Dependencies` example.

##### No Dependencies

Simple, sparsest of collections with *all* Plugins having zero dependencies.

```mermaid
flowchart LR
Plugin1
Plugin2
Plugin3
Plugin4
```

##### Simple Dependencies

Still a fairly sparse collection with one or more Plugins having linear dependencies.

```mermaid
flowchart LR
Plugin1 --> Plugin10 --> Plugin11
Plugin2
Plugin3 --> Plugin30
Plugin4 --> Plugin40 --> Plugin41
```

We can see in this example that while Plugins have dependencies, they're fairly simple to resolve order. A Breadth-Depth search is performed, and in-order we define a chain until there aren't any leafs left.

The results in the FQNs directly mirror this chart since there isn't really any complexity, with the exception that when we *actually* instantiate dependencies, it is done in *post*-order to ensure their readiness, as opposed to the previous in-order we used to *a the chain.

##### Cross References

In this scenario, we start adding complications by having one depenency graph referencing another.

Let's start with an *unconnected* view view of the Manifest topology. Similar to the examples before, we have `Plugin1` through `Plugin4` loaded as top-level `BehaviorName`s for dependency evaluation:

```mermaid
flowchart LR
Plugin1 --> Plugin10 --> Plugin3 & Plugin11
Plugin3 --> Plugin30
Plugin11 --> Plugin40 --> Plugin41
```
```mermaid
flowchart LR
Plugin2 --> Plugin3 & Plugin11
Plugin3 --> Plugin30
Plugin11 --> Plugin40 --> Plugin41
```
```mermaid
flowchart LR
Plugin3 --> Plugin30
```
```mermaid
flowchart LR
Plugin4 --> Plugin40 --> Plugin41
```
As you can see, `Plugin3` and `Plugin4` still have straight forward depenency trees to be resolved. What you may also see is redundancy in `Plugin1` and `Plugin2`'s dependency trees with these exact same plugins being needed.

The *connected* graph looks like this:

```mermaid
flowchart LR
Plugin1 --> Plugin10
Plugin2
Plugin3 --> Plugin30
Plugin40 --> Plugin41

Plugin10 & Plugin2 --> Plugin11 & Plugin3
Plugin11 & Plugin4 --> Plugin40
```

We don't want to load the same plugin correctly, so it's important we resolve it correctly as displayed in the unconnected example, but treat it like the connected example.

As we resolve this tree, we'll end up with a load order of:

```mermaid
flowchart LR
Load_Plugin1 --First Load--> Plugin30 --First Load--> Plugin3 --First Load--> Plugin41 --First Load--> Plugin40 --First Load--> Plugin11 --First Load--> Plugin10 --First Load--> Plugin1
Load_Plugin2 --Skip--> Plugin30 --Skip--> Plugin3 --Skip--> Plugin41 --Skip--> Plugin40 --Skip--> Plugin11 --First Load--> Plugin2
Load_Plugin3 --Skip--> Plugin30 --Skip--> Plugin3
Load_Plugin4 --Skip--> Plugin41 --Skip--> Plugin40 --First Load--> Plugin4
```

##### Erroneous References

As mentioned, there *are* scenarios that just aren't valid: Self and Cyclical References within the dependency tree:

**Self Referenced:**

```mermaid
flowchart LR
Plugin1 --> Plugin10
Plugin2
Plugin3 --> Plugin30
Plugin40 --> Plugin41

Plugin10 & Plugin2 --> Plugin11 & Plugin3
Plugin11 & Plugin4 --> Plugin40

Plugin11 --Self Ref--x Plugin11

```

This fails both Dependency Trees for `Plugin1` and `Plugin2`, but not `Plugin3` and `Plugin4`.

**Cyclic Reference:**

```mermaid
flowchart LR
Plugin1 --> Plugin10
Plugin2
Plugin3 --> Plugin30
Plugin40 --> Plugin41

Plugin2 ---> Plugin11 & Plugin3
Plugin10 --> Plugin11 & Plugin3
Plugin11 & Plugin4 --> Plugin40
Plugin40 --Cyclic Ref--x Plugin10
```

This fails Dependency Trees for `Plugin1`, `Plugin2`, and `Plugin4`, but not `Plugin3`.

**Looking Up By BehaviorName**

In the previous examples, everything was simplified to simple names, but in reality a Plugin can be accessed in a number of ways.

> I'll lightly cover some concepts here, but be sure to fully read up `Accessor`s and `Behavior`s!

What makes this Plugin architecture unique is the ability to retrieve, or *access* ,Plugins by an `AccessorName`, which in turn must match a `BehaviorName`. Because of the nature of `BehaviorName`s, *multiple* Plugins can satisfy a generic request, however only *one* can satisfy a *Fully Qualified Name* (FQN, i.e., `Plugin1-v1.0.0`). To be explicit here, that means multiple Plugins *can* satisfy `Plugin1`.

For example, let's say we have a generic `BehaviorName` called `com.nfg.generic.messaging.chat`. Let's also assume we've documented this `BehaviorName` and it simply is a generic method to send a simple chat message. No fuss, no muss!

What may not be obvious, is there may be 2 or more Plugins that can satisfy this! Read up more in [`Behavior`s]() section to get a better grasp of this.

```mermaid
flowchart LR

subgraph Satisfy com.nfg.generic.messaging.chat
B["com.nfg.messaging.chat.twitch"] & C["com.nfg.messaging.chat.discord"] & D["com.nfg.messaging.chat.slack"]
end

subgraph Requested AccessorName
A["com.nfg.generic.messaging.chat"] --> B & C & D
end

subgraph Third Party Libs/Wrappers
B --> com.twitch.somelib
C --> you.get
D --> the.idea
end
```

As possibly suspected, this will only succeed should the required `AccessorName`s be available and resolve to an FQN throughout a chain.

To explicitly demonstrate, the desired resolution here is:

```mermaid
flowchart LR
A["com.twitch.somelib-v1.0.0"] --> B["com.nfg.messaging.chat.twitch-v1.2.0"] --> C["you.get-v0.3.1"] --> D["com.nfg.messaging.chat.discord-v1.0.4"] --> E["the.idea-v0.6.9"] --> F["com.nfg.messaging.chat.slack-v1.1.3"] --> G["com.nfg.generic.messaging.chat"]
```

Take note that this tree is still reasonably simple, and resolves seemingly linearly. However as seen in the `AccesorName` graph earlier, there are independent Dependency Trees.
