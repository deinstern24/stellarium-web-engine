// Stellarium Web - Copyright (c) 2018 - Noctua Software Ltd
//
// This program is licensed under the terms of the GNU AGPL v3, or
// alternatively under a commercial licence.
//
// The terms of the AGPL v3 license can be found in the main directory of this
// repository.

<template>
<v-dialog scrollable max-width='600' v-model="$store.state.showAbout">
  <v-card v-if="$store.state.showAbout">
    <v-card-title><div class="text-h5">{{ $t('About') }}</div></v-card-title>
    <v-card-text style="height: 600px;">
      <p><div v-html="$t('about.intro')"></div>
      <br><div v-html="$t('about.source')"></div>
      <br><div v-html="$t('about.support')"></div>
      </p>
    </v-card-text>
    <v-card-actions>
      <v-spacer></v-spacer><v-btn text class="blue--text darken-1" @click.native="$store.state.showAbout = false">Close</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
</template>

<script>
</script>

<style>
.data-credits {
  padding-left: 30px;
}
a {
  color: #82b1ff;
}
</style>
