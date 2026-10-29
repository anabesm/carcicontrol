<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Plus, Search, UsersRound } from '@lucide/vue'
import { useRouter } from 'vue-router'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import { employeesApi } from '@/services/employees'
import { ApiError } from '@/services/api'
import type { Usuario } from '@/types/usuario'

const router = useRouter()
const employees = ref<Usuario[]>([])
const loading = ref(true)
const errorMessage = ref('')
const search = ref('')
let active = true
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const filtered = computed(() =>
  employees.value.filter((user) =>
    normalize(`${user.nome} ${user.email}`).includes(normalize(search.value.trim())),
  ),
)

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await employeesApi.list()
    if (active) employees.value = result.usuarios
  } catch (error) {
    if (!active || (error instanceof ApiError && error.status === 401)) return
    if (error instanceof ApiError && error.status === 403) {
      await router.replace('/acesso-negado')
      return
    }
    errorMessage.value =
      error instanceof Error ? error.message : 'Não foi possível carregar os funcionários.'
  } finally {
    if (active) loading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => {
  active = false
})
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>Funcionários</h1>
    </div>
    <BaseButton to="/funcionarios/novo"><Plus :size="18" />Novo funcionário</BaseButton>
  </div>
  <section class="data-panel" aria-label="Funcionários cadastrados">
    <div class="list-toolbar">
      <div>
        <h2>Equipe cadastrada</h2>
        <p v-if="!loading && !errorMessage">
          {{ employees.length }} {{ employees.length === 1 ? 'funcionário' : 'funcionários' }}
        </p>
      </div>
      <BaseField
        v-model="search"
        label="Buscar funcionário"
        type="search"
        hide-label
        placeholder="Buscar por nome ou e-mail"
        autocomplete="off"
        ><template #leading><Search :size="17" /></template
      ></BaseField>
    </div>
    <BaseLoading v-if="loading" label="Carregando funcionários…" />
    <div v-else-if="errorMessage" class="panel-feedback">
      <BaseAlert title="Não foi possível carregar a equipe" tone="error">{{
        errorMessage
      }}</BaseAlert
      ><BaseButton variant="secondary" @click="load">Tentar novamente</BaseButton>
    </div>
    <BaseEmptyState
      v-else-if="!employees.length"
      title="Sua equipe começa aqui"
      description="Cadastre o primeiro funcionário para liberar o acesso ao sistema."
      :icon="UsersRound"
      ><BaseButton to="/funcionarios/novo"
        ><Plus :size="17" />Cadastrar funcionário</BaseButton
      ></BaseEmptyState
    >
    <BaseEmptyState
      v-else-if="!filtered.length"
      title="Nenhum funcionário encontrado"
      description="Tente outro nome ou e-mail, ou limpe a busca."
      :icon="Search"
      ><BaseButton variant="secondary" @click="search = ''"
        >Limpar busca</BaseButton
      ></BaseEmptyState
    >
    <table v-else class="employee-table">
      <caption class="sr-only">
        Funcionários da equipe
      </caption>
      <thead>
        <tr>
          <th scope="col">Funcionário</th>
          <th scope="col">Contato</th>
          <th scope="col">Perfil</th>
          <th scope="col">Situação</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in filtered" :key="user.id">
          <td>
            <span class="employee-name">{{ user.nome }}</span
            ><span class="employee-email">{{ user.email }}</span>
          </td>
          <td data-label="Telefone">{{ user.telefone || 'Não informado' }}</td>
          <td data-label="Perfil">Funcionário</td>
          <td data-label="Situação">
            <span
              class="status-badge"
              :class="{ 'status-badge--inactive': user.status !== 'ATIVO' }"
              ><span aria-hidden="true"></span
              >{{ user.status === 'ATIVO' ? 'Ativo' : 'Inativo' }}</span
            >
          </td>
        </tr>
      </tbody>
    </table>
  </section>
  <p class="page-footnote">Somente administradores podem consultar e cadastrar funcionários.</p>
</template>
